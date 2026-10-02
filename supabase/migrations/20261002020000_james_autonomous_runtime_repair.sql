-- Repair production drift for James autonomous capability learning and system identity.
-- The autonomous heartbeat uses a service-owned UUID so downstream tables that
-- intentionally use uuid user_id can participate without changing user-facing identity storage.

create table if not exists public.james_improvement_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_evaluation_id uuid,
  title text not null,
  problem text not null,
  target_capability text not null,
  evidence jsonb not null default '{}'::jsonb,
  priority integer not null default 50 check (priority between 0 and 100),
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  status text not null default 'proposed'
    check (status in ('proposed','queued','running','completed','blocked')),
  evolution_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_improvement_goals_user_status_idx
  on public.james_improvement_goals(user_id, status, priority desc);

create index if not exists james_improvement_goals_capability_idx
  on public.james_improvement_goals(user_id, target_capability, status);

alter table public.james_improvement_goals enable row level security;

create or replace function public.set_james_improvement_goals_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_improvement_goals_updated_at
on public.james_improvement_goals;

create trigger james_improvement_goals_updated_at
before update on public.james_improvement_goals
for each row
execute function public.set_james_improvement_goals_updated_at();

create or replace function public.claim_james_autonomous_goal()
returns setof public.james_autonomous_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.james_autonomous_goals;
begin
  perform pg_advisory_xact_lock(hashtext('james-autonomous-goal-claim'));

  update public.james_autonomous_goals
  set status = 'running',
      last_run_at = now(),
      attempts = attempts + 1,
      last_error = null
  where id = (
    select id
    from public.james_autonomous_goals
    where status = 'pending'
      and next_run_at <= now()
    order by priority desc, next_run_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  if found then
    return next claimed;
  end if;

  insert into public.james_autonomous_goals (
    user_id, conversation_id, title, goal, priority, max_cycles, next_run_at
  )
  values (
    '00000000-0000-0000-0000-000000000001',
    'system-autonomous',
    'Autonomous learning cycle',
    'Pelajari satu capability yang paling membutuhkan peningkatan berdasarkan self-model James. Bandingkan hasil provider, verifikasi evidence, simpan pembelajaran tervalidasi, lalu tentukan langkah belajar berikutnya. Jangan mengubah production code atau konfigurasi deployment.',
    100,
    2,
    now()
  )
  returning * into claimed;

  update public.james_autonomous_goals
  set status = 'running',
      last_run_at = now(),
      attempts = attempts + 1,
      last_error = null
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_james_autonomous_goal() from public, anon, authenticated;
grant execute on function public.claim_james_autonomous_goal() to service_role;
