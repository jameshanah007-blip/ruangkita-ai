-- James Self-Reflection Engine
-- Stores internal reflection separately from durable growth state.

create table if not exists public.james_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid,
  observation text not null default '',
  what_worked text not null default '',
  what_failed text not null default '',
  lesson text not null default '',
  confidence numeric(3,2) not null default 0.50
    check (confidence >= 0 and confidence <= 1),
  evidence text not null default '',
  applied_to_growth boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists james_reflections_user_created_idx
  on public.james_reflections(user_id, created_at desc);

create index if not exists james_reflections_conversation_idx
  on public.james_reflections(conversation_id, created_at desc);

alter table public.james_reflections enable row level security;

revoke all on table public.james_reflections from anon, authenticated;
grant all on table public.james_reflections to service_role;

comment on table public.james_reflections is
  'Internal James reflection records. Reflection is evidence; durable character changes remain in james_growth_state.';
