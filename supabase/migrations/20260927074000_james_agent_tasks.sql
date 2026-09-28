create table if not exists public.james_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  conversation_id uuid,
  request text not null,
  status text not null default 'running' check (status in ('running','completed','failed','paused')),
  current_step integer not null default 0,
  max_steps integer not null default 8,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_agent_tasks_conversation_idx
  on public.james_agent_tasks(conversation_id, updated_at desc);

create index if not exists james_agent_tasks_user_idx
  on public.james_agent_tasks(user_id, updated_at desc);
