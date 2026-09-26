-- James Memory 2.0
-- Structured, confidence-scored, expirable long-term memory.
-- Raw conversation history remains in ai_messages; this table stores only validated memory candidates.

create table if not exists public.james_memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  memory_type text not null check (
    memory_type in ('identity','preference','interest','project','goal','context','relationship')
  ),
  memory_key text not null,
  memory_value text not null,
  confidence numeric(3,2) not null default 0.70 check (confidence >= 0 and confidence <= 1),
  status text not null default 'active' check (
    status in ('active','superseded','expired','rejected')
  ),
  source_excerpt text not null default '',
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists james_memories_active_key_idx
  on public.james_memories(user_id, memory_type, memory_key)
  where status = 'active';

create index if not exists james_memories_user_status_idx
  on public.james_memories(user_id, status, updated_at desc);

create index if not exists james_memories_expiry_idx
  on public.james_memories(status, expires_at)
  where expires_at is not null;

alter table public.james_memories enable row level security;

revoke all on table public.james_memories from anon, authenticated;
grant all on table public.james_memories to service_role;

comment on table public.james_memories is
  'Validated long-term James memory. Never use this table for secrets or sensitive personal data.';
