-- James Autonomous AI Brain state
create table if not exists public.james_autonomous_brain_state (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  autonomy_mode text not null default 'supervised'
    check (autonomy_mode in ('supervised','bounded','autonomous')),
  status text not null default 'idle'
    check (status in ('idle','observing','thinking','acting','verifying','learning','evolving','blocked','completed','failed')),
  current_goal text,
  current_task_id uuid,
  cycle_count integer not null default 0,
  successful_cycles integer not null default 0,
  failed_cycles integer not null default 0,
  last_confidence numeric not null default 0,
  last_decision text,
  last_error text,
  last_cycle_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists james_autonomous_brain_state_user_idx
  on public.james_autonomous_brain_state(user_id);

alter table public.james_autonomous_brain_state enable row level security;

create or replace function public.set_james_autonomous_brain_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_autonomous_brain_updated_at
on public.james_autonomous_brain_state;

create trigger james_autonomous_brain_updated_at
before update on public.james_autonomous_brain_state
for each row
execute function public.set_james_autonomous_brain_updated_at();
