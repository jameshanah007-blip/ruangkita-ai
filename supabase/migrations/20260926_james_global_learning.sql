-- Global James Learning Pool
-- Contains aggregated, non-identifying learning candidates only.

create table if not exists public.james_global_growth (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  key text not null,
  value text not null,
  rationale text not null default '',
  evidence_count integer not null default 0,
  consensus_score numeric(3,2) not null default 0,
  status text not null default 'candidate',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_global_growth_status_idx
  on public.james_global_growth(status, updated_at desc);

create table if not exists public.james_global_learning_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid,
  provider text not null,
  decision text not null,
  confidence numeric(3,2) not null default 0,
  rationale text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists james_global_learning_runs_candidate_idx
  on public.james_global_learning_runs(candidate_id, created_at desc);

alter table public.james_global_growth enable row level security;
alter table public.james_global_learning_runs enable row level security;

revoke all on table public.james_global_growth from anon, authenticated;
revoke all on table public.james_global_learning_runs from anon, authenticated;

grant all on table public.james_global_growth to service_role;
grant all on table public.james_global_learning_runs to service_role;
