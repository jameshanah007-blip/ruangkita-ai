create table if not exists public.james_capability_mastery_history (
  id uuid primary key default gen_random_uuid(),
  capability text not null,
  previous_mastery numeric(5,4) not null,
  new_mastery numeric(5,4) not null,
  delta numeric(6,4) not null,
  outcome text not null,
  quality numeric(5,4) not null,
  evidence jsonb,
  regression boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists james_capability_mastery_history_idx
  on public.james_capability_mastery_history(capability, created_at desc);

alter table public.james_capability_mastery_history enable row level security;

create or replace function public.update_james_capability_mastery(
  p_capability text,
  p_outcome text,
  p_quality numeric,
  p_evidence jsonb default null
)
returns public.james_capability_mastery
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.james_capability_mastery;
  v_previous numeric;
  v_quality numeric := greatest(0, least(1, coalesce(p_quality, 0.5)));
  v_delta numeric;
  v_new numeric;
  v_regression boolean := false;
begin
  if p_capability is null or length(trim(p_capability)) = 0 then
    raise exception 'capability is required';
  end if;

  insert into public.james_capability_mastery(capability)
  values (left(trim(p_capability), 200))
  on conflict (capability) do nothing;

  select mastery into v_previous
  from public.james_capability_mastery
  where capability = left(trim(p_capability), 200)
  for update;

  if p_outcome = 'success' then
    v_delta := 0.08 * v_quality;
  elsif p_outcome = 'failure' then
    v_delta := -0.10 * (1 - v_quality);
    if v_previous >= 0.7 then
      v_regression := true;
    end if;
  else
    v_delta := 0.02 * (v_quality - 0.5);
  end if;

  v_new := greatest(0, least(1, v_previous + v_delta));

  update public.james_capability_mastery
  set mastery = v_new,
      attempts = attempts + 1,
      successes = successes + case when p_outcome = 'success' then 1 else 0 end,
      last_evaluated_at = now(),
      last_outcome = p_outcome,
      last_evidence = p_evidence,
      updated_at = now()
  where capability = left(trim(p_capability), 200)
  returning * into row_data;

  insert into public.james_capability_mastery_history(
    capability, previous_mastery, new_mastery, delta, outcome, quality, evidence, regression
  )
  values (
    left(trim(p_capability), 200), v_previous, v_new, v_new - v_previous,
    p_outcome, v_quality, p_evidence, v_regression
  );

  return row_data;
end;
$$;

revoke all on function public.update_james_capability_mastery(text,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.update_james_capability_mastery(text,text,numeric,jsonb) to service_role;
