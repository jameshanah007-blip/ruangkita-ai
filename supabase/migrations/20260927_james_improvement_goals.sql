create table if not exists public.james_improvement_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_evaluation_id uuid,
  title text not null,
  problem text not null,
  target_capability text not null,
  evidence jsonb not null default '{}'::jsonb,
  priority integer not null default 50,
  confidence numeric not null default 0.5,
  status text not null default 'proposed'
    check (status in ('proposed','queued','running','completed','rejected','blocked')),
  evolution_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_improvement_goals_user_status_idx
  on public.james_improvement_goals(user_id, status, priority desc);

create index if not exists james_improvement_goals_source_idx
  on public.james_improvement_goals(source_evaluation_id);

alter table public.james_improvement_goals enable row level security;

create or replace function public.set_james_improvement_goals_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_improvement_goals_updated_at
on public.james_improvement_goals;

create trigger james_improvement_goals_updated_at
before update on public.james_improvement_goals
for each row execute function public.set_james_improvement_goals_updated_at();
