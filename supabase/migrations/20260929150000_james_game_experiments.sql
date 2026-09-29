create table if not exists public.james_game_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  conversation_id text,
  capability_key text,
  capability_name text,
  prompt text not null,
  blueprint jsonb,
  game_html text,
  status text not null default 'pending_verification'
    check (status in ('planned','generated','pending_verification','verified','failed')),
  test_report jsonb,
  learning_result jsonb,
  attempt integer not null default 0,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists james_game_experiments_status_idx
  on public.james_game_experiments(status, created_at desc);

alter table public.james_game_experiments enable row level security;
