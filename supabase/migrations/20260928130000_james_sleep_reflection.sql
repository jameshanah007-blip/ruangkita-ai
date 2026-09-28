-- James autonomous sleep/reflection audit trail.
-- System reflections are stored separately from user memories.

create table if not exists public.james_sleep_cycles (
  id uuid primary key default gen_random_uuid(),
  cycle_type text not null default 'daily',
  provider text not null default '',
  summary text not null default '',
  what_improved jsonb not null default '[]'::jsonb,
  what_failed jsonb not null default '[]'::jsonb,
  next_focus jsonb not null default '[]'::jsonb,
  goal_updates integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists james_sleep_cycles_created_idx
  on public.james_sleep_cycles(created_at desc);

alter table public.james_sleep_cycles enable row level security;
revoke all on table public.james_sleep_cycles from anon, authenticated;
grant all on table public.james_sleep_cycles to service_role;
