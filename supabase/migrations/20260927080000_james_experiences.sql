create table if not exists public.james_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  conversation_id uuid,
  task_id uuid,
  pattern text not null,
  strategy text not null,
  capabilities jsonb not null default '[]'::jsonb,
  success_count integer not null default 1,
  failure_count integer not null default 0,
  confidence numeric not null default 0.8,
  status text not null default 'active' check (status in ('active','candidate','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_experiences_user_idx
  on public.james_experiences(user_id, status, updated_at desc);

create index if not exists james_experiences_pattern_idx
  on public.james_experiences(pattern, status);

alter table public.james_experiences
  drop constraint if exists james_experiences_user_id_fkey;

alter table public.james_experiences
  add column if not exists failure_count integer not null default 0;
