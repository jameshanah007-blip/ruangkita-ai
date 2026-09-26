-- James Memory 2.0
-- Structured, confidence-scored, auditable long-term memory.
-- Core identity is never stored here.

create table if not exists public.james_memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid,
  memory_type text not null check (
    memory_type in (
      'identity',
      'preference',
      'interest',
      'project',
      'goal',
      'context',
      'communication_style'
    )
  ),
  memory_key text not null,
  memory_value text not null,
  confidence numeric(3,2) not null default 0.80 check (confidence >= 0 and confidence <= 1),
  source_excerpt text not null default '',
  status text not null default 'active' check (
    status in ('active', 'superseded', 'expired', 'rejected')
  ),
  first_confirmed_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists james_memories_active_unique_idx
  on public.james_memories(user_id, memory_type, memory_key)
  where status = 'active';

create index if not exists james_memories_user_status_idx
  on public.james_memories(user_id, status, last_confirmed_at desc);

create index if not exists james_memories_conversation_idx
  on public.james_memories(conversation_id);

create table if not exists public.james_memory_events (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid,
  user_id text not null,
  conversation_id uuid,
  action text not null check (
    action in ('created', 'confirmed', 'updated', 'superseded', 'expired', 'rejected')
  ),
  memory_type text not null,
  memory_key text not null,
  old_value text,
  new_value text,
  confidence numeric(3,2) check (confidence >= 0 and confidence <= 1),
  source_excerpt text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists james_memory_events_user_created_idx
  on public.james_memory_events(user_id, created_at desc);

alter table public.james_memories enable row level security;
alter table public.james_memory_events enable row level security;

revoke all on table public.james_memories from anon, authenticated;
revoke all on table public.james_memory_events from anon, authenticated;

grant all on table public.james_memories to service_role;
grant all on table public.james_memory_events to service_role;

comment on table public.james_memories is
  'Long-term user-specific memories for James. Only explicit, non-sensitive, evidence-based facts are allowed.';

comment on table public.james_memory_events is
  'Auditable lifecycle history for James long-term memories.';
