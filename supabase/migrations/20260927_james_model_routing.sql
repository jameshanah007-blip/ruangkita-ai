alter table public.james_model_registry
  add column if not exists canary_attempts integer not null default 0,
  add column if not exists canary_successes integer not null default 0,
  add column if not exists canary_quality numeric not null default 0,
  add column if not exists routing_weight numeric not null default 0,
  add column if not exists last_canary_at timestamptz;

create index if not exists james_model_registry_routing_idx
  on public.james_model_registry(user_id, status, routing_weight);
