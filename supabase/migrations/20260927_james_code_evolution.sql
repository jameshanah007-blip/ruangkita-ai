create table if not exists public.james_code_evolution_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id text not null,
  request text not null,
  goal text not null,
  rationale text not null,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','applied','failed')),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  files jsonb not null default '[]'::jsonb,
  tests jsonb not null default '[]'::jsonb,
  provider_reviews jsonb not null default '[]'::jsonb,
  branch_name text,
  pull_request_url text,
  commit_sha text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.james_code_evolution_proposals enable row level security;

create index if not exists james_code_evolution_proposals_user_idx
  on public.james_code_evolution_proposals(user_id, created_at desc);

create index if not exists james_code_evolution_proposals_status_idx
  on public.james_code_evolution_proposals(status, created_at desc);

create or replace function public.touch_james_code_evolution_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists james_code_evolution_updated_at on public.james_code_evolution_proposals;

create trigger james_code_evolution_updated_at
before update on public.james_code_evolution_proposals
for each row execute function public.touch_james_code_evolution_updated_at();
