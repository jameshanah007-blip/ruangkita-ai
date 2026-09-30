create table if not exists public.james_capability_recovery (
  capability text primary key,
  baseline_mastery numeric(5,4) not null,
  target_mastery numeric(5,4) not null default 0.7,
  status text not null default 'pending' check (status in ('pending','verifying','recovered','failed')),
  attempts integer not null default 0,
  last_task_id uuid,
  last_evidence jsonb,
  started_at timestamptz not null default now(),
  recovered_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.james_capability_recovery enable row level security;

create or replace function public.begin_james_capability_recovery(
  p_capability text,
  p_baseline_mastery numeric,
  p_task_id uuid default null
)
returns public.james_capability_recovery
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.james_capability_recovery;
begin
  insert into public.james_capability_recovery(
    capability, baseline_mastery, target_mastery, status, attempts, last_task_id, updated_at
  )
  values (
    left(trim(p_capability), 200),
    greatest(0, least(1, p_baseline_mastery)),
    greatest(0.7, greatest(0, least(1, p_baseline_mastery)) + 0.05),
    'verifying', 1, p_task_id, now()
  )
  on conflict (capability) do update set
    baseline_mastery = least(public.james_capability_recovery.baseline_mastery, excluded.baseline_mastery),
    status = case when public.james_capability_recovery.status = 'recovered' then 'verifying' else 'verifying' end,
    attempts = public.james_capability_recovery.attempts + 1,
    last_task_id = excluded.last_task_id,
    updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.verify_james_capability_recovery(
  p_capability text,
  p_new_mastery numeric,
  p_evidence jsonb default null
)
returns public.james_capability_recovery
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.james_capability_recovery;
begin
  update public.james_capability_recovery
  set status = case
      when p_new_mastery >= target_mastery and p_new_mastery > baseline_mastery
        then 'recovered'
      else 'failed'
    end,
    last_evidence = p_evidence,
    recovered_at = case
      when p_new_mastery >= target_mastery and p_new_mastery > baseline_mastery then now()
      else null
    end,
    updated_at = now()
  where capability = left(trim(p_capability), 200)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.begin_james_capability_recovery(text,numeric,uuid) from public, anon, authenticated;
revoke all on function public.verify_james_capability_recovery(text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.begin_james_capability_recovery(text,numeric,uuid) to service_role;
grant execute on function public.verify_james_capability_recovery(text,numeric,jsonb) to service_role;
