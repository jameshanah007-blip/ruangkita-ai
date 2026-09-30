alter table public.james_experiences
  add column if not exists last_evidence jsonb not null default '{}'::jsonb;

comment on column public.james_experiences.last_evidence is
  'Durable structured evidence for James strategy, tournament, comparison, and learning memories.';
