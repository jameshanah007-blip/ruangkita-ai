create table if not exists public.james_decision_memory (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  mode text not null check (mode in ('single','multi','fallback','specialized')),
  providers jsonb not null default '[]'::jsonb,
  reason text not null default '',
  outcome text not null check (outcome in ('success','failure','partial')),
  quality numeric not null default 0.5,
  verified boolean not null default false,
  evidence_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists james_decision_memory_task_idx
  on public.james_decision_memory(task, created_at desc);

create index if not exists james_decision_memory_outcome_idx
  on public.james_decision_memory(outcome, quality desc);
