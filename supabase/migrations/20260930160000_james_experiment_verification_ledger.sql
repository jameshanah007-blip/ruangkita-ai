create table if not exists public.james_experiment_verification_ledger (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.james_game_experiments(id) on delete cascade,
  attempt integer not null,
  stage text not null default 'claimed',
  learning_completed boolean not null default false,
  brain_evidence_completed boolean not null default false,
  strategy_memory_completed boolean not null default false,
  strategy_feedback_completed boolean not null default false,
  finalized boolean not null default false,
  processing_token text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id, attempt)
);
alter table public.james_experiment_verification_ledger enable row level security;
revoke all on public.james_experiment_verification_ledger from anon, authenticated;
grant all on public.james_experiment_verification_ledger to service_role;
create index if not exists james_experiment_verification_ledger_experiment_idx
on public.james_experiment_verification_ledger (experiment_id, attempt desc);