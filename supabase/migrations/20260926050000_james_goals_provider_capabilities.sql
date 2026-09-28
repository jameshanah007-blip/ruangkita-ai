-- James autonomous learning goals and provider capability journal

create table if not exists public.james_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  goal text not null,
  reason text not null default '',
  progress numeric(3,2) not null default 0
    check (progress >= 0 and progress <= 1),
  status text not null default 'active'
    check (status in ('active','paused','completed','dismissed')),
  evidence text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_goals_user_status_idx
  on public.james_goals(user_id, status, updated_at desc);

alter table public.james_goals enable row level security;
revoke all on table public.james_goals from anon, authenticated;
grant all on table public.james_goals to service_role;

create table if not exists public.james_provider_capabilities (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini','openrouter','groq')),
  model text not null,
  capability jsonb not null default '{}'::jsonb,
  source text not null default '',
  observed_at timestamptz not null default now()
);

create index if not exists james_provider_capabilities_provider_idx
  on public.james_provider_capabilities(provider, observed_at desc);

alter table public.james_provider_capabilities enable row level security;
revoke all on table public.james_provider_capabilities from anon, authenticated;
grant all on table public.james_provider_capabilities to service_role;

comment on table public.james_goals is
  'Bounded development goals for James. Goals are learning objectives, not unrestricted autonomous actions.';

comment on table public.james_provider_capabilities is
  'Observed provider/model capabilities used to keep James aware of changing AI infrastructure.';
