create table if not exists public.james_provider_performance (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  task text not null,
  attempts integer not null default 0,
  successes integer not null default 0,
  failures integer not null default 0,
  total_quality numeric not null default 0,
  total_latency_ms bigint not null default 0,
  last_quality numeric not null default 0.5,
  last_latency_ms integer,
  confidence numeric not null default 0.2,
  updated_at timestamptz not null default now(),
  unique(provider, task)
);

create index if not exists james_provider_performance_task_idx
  on public.james_provider_performance(task, confidence desc);
