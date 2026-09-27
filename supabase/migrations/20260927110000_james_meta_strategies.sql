create table if not exists public.james_meta_strategies (
  id uuid primary key default gen_random_uuid(),
  task_class text not null,
  strategy text not null,
  capabilities jsonb not null default '[]'::jsonb,
  evidence_count integer not null default 1,
  success_count integer not null default 1,
  failure_count integer not null default 0,
  confidence numeric not null default 0.5,
  status text not null default 'candidate' check (status in ('candidate','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_meta_strategies_task_class_idx
  on public.james_meta_strategies(task_class, status, confidence desc);

create index if not exists james_meta_strategies_updated_idx
  on public.james_meta_strategies(updated_at desc);
