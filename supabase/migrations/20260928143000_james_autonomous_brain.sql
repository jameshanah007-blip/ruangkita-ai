create table if not exists public.james_capabilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  domain text not null default 'general',
  skills jsonb not null default '[]'::jsonb,
  strategy text not null default '',
  limitations jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  test_cases jsonb not null default '[]'::jsonb,
  success_rate numeric not null default 0 check (success_rate >= 0 and success_rate <= 1),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  version integer not null default 1,
  status text not null default 'candidate' check (status in ('candidate','validated','deprecated')),
  source_type text not null default 'experience' check (source_type in ('experience','provider_comparison','public_knowledge')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists james_capabilities_name_key
  on public.james_capabilities (lower(name));

create index if not exists james_capabilities_status_confidence_idx
  on public.james_capabilities (status, confidence desc);

alter table public.james_capabilities enable row level security;

revoke all on public.james_capabilities from anon, authenticated;
grant all on public.james_capabilities to service_role;
