create table if not exists public.james_knowledge_conflicts (
  id uuid primary key default gen_random_uuid(),
  capability text not null,
  context_key text not null,
  candidate_a jsonb not null,
  candidate_b jsonb not null,
  score_a numeric(6,4) not null default 0,
  score_b numeric(6,4) not null default 0,
  selected text check (selected in ('a','b','unresolved')),
  resolution_reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists james_knowledge_conflicts_lookup_idx
  on public.james_knowledge_conflicts(capability, context_key, created_at desc);

alter table public.james_knowledge_conflicts enable row level security;
