-- James Multi-Provider Learning Audit
-- Records which AI engines contributed to a James learning cycle.

create table if not exists public.james_learning_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid,
  provider text not null check (provider in ('gemini','openrouter','groq')),
  model text not null default '',
  success boolean not null default false,
  contribution text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists james_learning_runs_user_created_idx
  on public.james_learning_runs(user_id, created_at desc);

alter table public.james_learning_runs enable row level security;

revoke all on table public.james_learning_runs from anon, authenticated;
grant all on table public.james_learning_runs to service_role;

comment on table public.james_learning_runs is
  'Audit trail showing which AI providers contributed to each James learning cycle.';
