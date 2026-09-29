create table if not exists public.james_capability_mastery_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  capability_key text not null,
  previous_competence numeric not null default 0.5,
  competence numeric not null,
  previous_confidence numeric not null default 0.2,
  confidence numeric not null,
  evidence_count integer not null default 0,
  outcome text not null,
  source text not null default 'fun-zone',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_capability_mastery_history_lookup_idx
  on public.james_capability_mastery_history(user_id, capability_key, created_at desc);

alter table public.james_capability_mastery_history enable row level security;
