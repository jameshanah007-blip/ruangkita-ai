create extension if not exists pgcrypto;

create table if not exists public.james_model_registry (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  learning_job_id uuid,
  provider text not null,
  base_model text not null,
  candidate_model text,
  status text not null default 'experimental'
    check (status in ('experimental','eligible','active','rejected','failed')),
  validation_score numeric not null default 0,
  baseline_score numeric not null default 0,
  validation_samples integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_model_registry_user_idx
  on public.james_model_registry(user_id, created_at desc);
create index if not exists james_model_registry_status_idx
  on public.james_model_registry(status);

alter table public.james_model_registry enable row level security;

create or replace function public.james_model_registry_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_model_registry_updated_at on public.james_model_registry;
create trigger james_model_registry_updated_at
before update on public.james_model_registry
for each row execute function public.james_model_registry_updated_at();
