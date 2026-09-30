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
  learning_result jsonb,
  brain_evidence_result jsonb,
  strategy_memory_result jsonb,
  final_payload jsonb,
  evolution_completed boolean not null default false,
  evolution_result jsonb,
  mutation_completed boolean not null default false,
  mutation_result jsonb,
  recovery_completed boolean not null default false,
  recovery_result jsonb,
  exploration_completed boolean not null default false,
  exploration_result jsonb,
  learning_mode_completed boolean not null default false,
  learning_mode_result jsonb,
  knowledge_completed boolean not null default false,
  knowledge_result jsonb,
  skills_completed boolean not null default false,
  skills_result jsonb,
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