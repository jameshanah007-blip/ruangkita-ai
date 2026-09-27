create table if not exists public.james_self_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  conversation_id uuid,
  task_id uuid,
  outcome text not null check (outcome in ('success','failure','partial')),
  quality_score numeric not null default 0.5,
  root_cause text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  provider_observations jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_self_evaluations_task_idx
  on public.james_self_evaluations(task_id, created_at desc);

create index if not exists james_self_evaluations_user_idx
  on public.james_self_evaluations(user_id, created_at desc);

alter table public.james_self_evaluations
  drop constraint if exists james_self_evaluations_user_id_fkey;
alter table public.james_self_evaluations
  drop constraint if exists james_self_evaluations_task_id_fkey;
