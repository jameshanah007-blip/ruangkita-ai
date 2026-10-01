-- Persist the latest source event key for atomic James memory deduplication.
alter table public.james_experiences
  add column if not exists last_source_event_key text;

create index if not exists james_experiences_last_source_event_key_idx
  on public.james_experiences(last_source_event_key)
  where last_source_event_key is not null;
