-- James Autonomous Brain goal queue
create table if not exists public.james_autonomous_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id text not null,
  title text not null,
  goal text not null,
  status text not null default 'pending'
    check (status in ('pending','running','paused','completed','failed')),
  priority integer not null default 50,
  max_cycles integer not null default 2,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  attempts integer not null default 0,
  last_result text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_autonomous_goals_due_idx
  on public.james_autonomous_goals(status, next_run_at, priority desc);

create index if not exists james_autonomous_goals_user_idx
  on public.james_autonomous_goals(user_id, status);

alter table public.james_autonomous_goals enable row level security;

create or replace function public.set_james_autonomous_goals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_autonomous_goals_updated_at
on public.james_autonomous_goals;

create trigger james_autonomous_goals_updated_at
before update on public.james_autonomous_goals
for each row
execute function public.set_james_autonomous_goals_updated_at();
