create table if not exists public.james_brain_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  model_name text not null,
  backend text not null default 'local',
  status text not null default 'candidate'
    check (status in ('candidate','testing','validated','active','rejected','retired')),
  dataset_version text,
  capabilities jsonb not null default '[]'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  success_rate numeric not null default 0 check (success_rate >= 0 and success_rate <= 1),
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create unique index if not exists james_brain_versions_version_key
  on public.james_brain_versions (version);

create table if not exists public.james_brain_training_examples (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid references public.james_capabilities(id) on delete set null,
  task text not null,
  expected_behavior text not null,
  test_case text not null,
  source_type text not null default 'synthetic'
    check (source_type in ('synthetic','experience','provider_comparison','public_knowledge')),
  quality_score numeric not null default 0 check (quality_score >= 0 and quality_score <= 1),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists james_brain_training_examples_capability_idx
  on public.james_brain_training_examples (capability_id, approved);

alter table public.james_brain_versions enable row level security;
alter table public.james_brain_training_examples enable row level security;

revoke all on public.james_brain_versions from anon, authenticated;
revoke all on public.james_brain_training_examples from anon, authenticated;
grant all on public.james_brain_versions to service_role;
grant all on public.james_brain_training_examples to service_role;
