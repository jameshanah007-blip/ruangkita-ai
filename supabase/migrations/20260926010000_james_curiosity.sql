-- James Curiosity Engine
-- Stores bounded questions/topics that James may want to understand better.
-- Curiosity is a planning state, not human emotion and not autonomous action.

create table if not exists public.james_curiosity (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid,
  topic text not null,
  question text not null,
  importance numeric(3,2) not null default 0.50
    check (importance >= 0 and importance <= 1),
  status text not null default 'open'
    check (status in ('open','exploring','answered','dismissed')),
  evidence text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_curiosity_user_status_idx
  on public.james_curiosity(user_id, status, updated_at desc);

create index if not exists james_curiosity_topic_idx
  on public.james_curiosity(topic);

alter table public.james_curiosity enable row level security;

revoke all on table public.james_curiosity from anon, authenticated;
grant all on table public.james_curiosity to service_role;

comment on table public.james_curiosity is
  'Bounded learning questions for James. Curiosity does not authorize autonomous external actions.';
