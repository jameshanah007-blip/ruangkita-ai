-- James Evolution Engine
-- Stores bounded, auditable experiences that can adapt James without changing his core identity.
-- All access remains server-side through SUPABASE_SECRET_KEY.

create table if not exists public.james_growth_state (
  user_id text primary key,
  communication_style jsonb not null default '{}'::jsonb,
  interests jsonb not null default '[]'::jsonb,
  learned_topics jsonb not null default '[]'::jsonb,
  lessons jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  evolution_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.james_evolution_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid,
  category text not null check (
    category in ('communication_style','interest','learned_topic','lesson','preference')
  ),
  key text not null,
  value text not null,
  reason text not null default '',
  confidence numeric(3,2) not null default 0.50 check (confidence >= 0 and confidence <= 1),
  source_excerpt text not null default '',
  status text not null default 'applied' check (status in ('applied', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists james_evolution_events_user_created_idx
  on public.james_evolution_events(user_id, created_at desc);

alter table public.james_growth_state enable row level security;
alter table public.james_evolution_events enable row level security;

revoke all on table public.james_growth_state from anon, authenticated;
revoke all on table public.james_evolution_events from anon, authenticated;

grant all on table public.james_growth_state to service_role;
grant all on table public.james_evolution_events to service_role;

comment on table public.james_growth_state is
  'Bounded per-user adaptive character state for James. Core identity is never stored here.';
comment on table public.james_evolution_events is
  'Auditable record of evidence-based character adaptations generated from conversations.';
