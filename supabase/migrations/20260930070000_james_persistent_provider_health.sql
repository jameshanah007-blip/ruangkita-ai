alter table public.james_provider_performance
  add column if not exists cooldown_until timestamptz,
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_kind text;

create index if not exists james_provider_performance_cooldown_idx
  on public.james_provider_performance(provider, cooldown_until);

comment on column public.james_provider_performance.cooldown_until is
  'Persistent provider cooldown. James should avoid this provider until the timestamp passes.';
comment on column public.james_provider_performance.last_failure_kind is
  'Normalized failure category such as quota, rate_limit, timeout, auth, server, or invalid_output.';
