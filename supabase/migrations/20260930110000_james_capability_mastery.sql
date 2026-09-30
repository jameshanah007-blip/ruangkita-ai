create table if not exists public.james_capability_mastery (
  capability text primary key,
  mastery numeric(5,4) not null default 0.5 check (mastery >= 0 and mastery <= 1),
  attempts integer not null default 0,
  successes integer not null default 0,
  last_evaluated_at timestamptz,
  last_outcome text,
  last_evidence jsonb,
  updated_at timestamptz not null default now()
);

alter table public.james_capability_mastery enable row level security;

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
  v_quality numeric := greatest(0, least(1, coalesce(p_quality, 0.5)));
  v_delta numeric;
begin
  if p_capability is null or length(trim(p_capability)) = 0 then
    raise exception 'capability is required';
  end if;

  insert into public.james_capability_mastery(capability)
  values (left(trim(p_capability), 200))
  on conflict (capability) do nothing;

  if p_outcome = 'success' then
    v_delta := 0.08 * v_quality;
  elsif p_outcome = 'failure' then
    v_delta := -0.10 * (1 - v_quality);
  else
    v_delta := 0.02 * (v_quality - 0.5);
  end if;

  update public.james_capability_mastery
  set mastery = greatest(0, least(1, mastery + v_delta)),
      attempts = attempts + 1,
      successes = successes + case when p_outcome = 'success' then 1 else 0 end,
      last_evaluated_at = now(),
      last_outcome = p_outcome,
      last_evidence = p_evidence,
      updated_at = now()
  where capability = left(trim(p_capability), 200)
  returning * into row_data;

  return row_data;
end;
$$;

revoke all on function public.update_james_capability_mastery(text,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.update_james_capability_mastery(text,text,numeric,jsonb) to service_role;
