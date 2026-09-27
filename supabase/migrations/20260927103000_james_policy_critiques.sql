create table if not exists public.james_policy_critiques (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  policy_mode text not null,
  policy_confidence numeric not null default 0.5,
  decision_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  average_quality numeric not null default 0.5,
  policy_score numeric not null default 0.5,
  recommendation text not null default 'hold',
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists james_policy_critiques_task_idx
  on public.james_policy_critiques(task, created_at desc);
