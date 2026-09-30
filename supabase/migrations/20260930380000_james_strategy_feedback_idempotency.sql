create table if not exists public.james_meta_strategy_trials (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null,
  scenario_key text not null,
  outcome text not null check (outcome in ('success','failure','partial','unknown')),
  quality numeric(5,4) not null default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  source_event_key text,
  created_at timestamptz not null default now()
);

alter table public.james_meta_strategy_trials
  add column if not exists source_event_key text;

create unique index if not exists james_meta_strategy_trials_event_key_uidx
  on public.james_meta_strategy_trials(source_event_key)
  where source_event_key is not null;

create index if not exists james_meta_strategy_trials_strategy_idx
  on public.james_meta_strategy_trials(strategy_id, created_at desc);

alter table public.james_meta_strategy_trials enable row level security;

create table if not exists public.james_strategy_comparison_events (
  source_event_key text primary key,
  trial_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists james_strategy_comparison_events_trial_idx
  on public.james_strategy_comparison_events(trial_id);

alter table public.james_strategy_comparison_events enable row level security;
