create table if not exists public.james_experience_consolidations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  source_experience_ids jsonb not null default '[]'::jsonb,
  merged_pattern text not null,
  merged_strategy text not null,
  capabilities jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0.8,
  evidence_count integer not null default 1,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_experience_consolidations_user_idx
  on public.james_experience_consolidations(user_id, status, confidence desc);

alter table public.james_experience_consolidations
  drop constraint if exists james_experience_consolidations_user_id_fkey;
