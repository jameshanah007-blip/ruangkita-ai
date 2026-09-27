create table if not exists public.james_self_model (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  capability_key text not null,
  capability_name text not null,
  competence numeric not null default 0.5,
  confidence numeric not null default 0.2,
  evidence_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  teacher_providers jsonb not null default '[]'::jsonb,
  active_models jsonb not null default '[]'::jsonb,
  last_evidence jsonb not null default '{}'::jsonb,
  next_learning_action text,
  status text not null default 'developing'
    check (status in ('unknown','developing','competent','strong','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, capability_key)
);

create index if not exists james_self_model_user_idx
  on public.james_self_model(user_id, status, competence desc);

alter table public.james_self_model enable row level security;

create or replace function public.james_self_model_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_self_model_updated_at on public.james_self_model;
create trigger james_self_model_updated_at
before update on public.james_self_model
for each row execute function public.james_self_model_updated_at();
