create extension if not exists pgcrypto;

create table if not exists public.james_model_learning_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  mode text not null check (mode in ('distillation','fine_tuning','lora_registration')),
  teacher_providers jsonb not null default '[]'::jsonb,
  target_provider text,
  base_model text,
  dataset jsonb not null default '[]'::jsonb,
  dataset_hash text,
  job_id text,
  fine_tuned_model text,
  status text not null default 'proposed'
    check (status in ('proposed','dataset_ready','submitted','running','completed','failed','blocked')),
  evidence jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_model_learning_jobs_user_idx
  on public.james_model_learning_jobs(user_id, created_at desc);

create index if not exists james_model_learning_jobs_status_idx
  on public.james_model_learning_jobs(status);

alter table public.james_model_learning_jobs enable row level security;

drop policy if exists "james model learning service access" on public.james_model_learning_jobs;
-- No client-facing policy is created. James accesses this table server-side
-- with SUPABASE_SECRET_KEY; Supabase service-role access bypasses RLS.
-- This prevents anonymous/authenticated clients from reading or mutating
-- model-learning datasets, provider job IDs, or adaptation metadata.

create or replace function public.james_model_learning_jobs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_model_learning_jobs_updated_at
  on public.james_model_learning_jobs;

create trigger james_model_learning_jobs_updated_at
before update on public.james_model_learning_jobs
for each row execute function public.james_model_learning_jobs_updated_at();
