-- James Game Learning Event Idempotency v1
-- Bind durable Game Brain evidence to one experiment attempt.
-- Upgrade-safe: legacy rows receive immutable synthetic keys.

alter table public.james_reflections
  add column if not exists source_event_key text;

update public.james_reflections
set source_event_key = coalesce(
  source_event_key,
  'legacy-reflection:' || id::text
)
where source_event_key is null;

alter table public.james_reflections
  alter column source_event_key set not null;

create unique index if not exists james_reflections_source_event_key_uidx
  on public.james_reflections(source_event_key);

alter table public.james_self_evaluations
  add column if not exists source_event_key text;

update public.james_self_evaluations
set source_event_key = coalesce(
  source_event_key,
  'legacy-self-evaluation:' || id::text
)
where source_event_key is null;

alter table public.james_self_evaluations
  alter column source_event_key set not null;

create unique index if not exists james_self_evaluations_source_event_key_uidx
  on public.james_self_evaluations(source_event_key);

alter table public.james_capability_mastery_history
  add column if not exists source_event_key text;

update public.james_capability_mastery_history
set source_event_key = coalesce(
  source_event_key,
  'legacy-mastery:' || id::text
)
where source_event_key is null;

alter table public.james_capability_mastery_history
  alter column source_event_key set not null;

create unique index if not exists james_capability_mastery_history_source_event_key_uidx
  on public.james_capability_mastery_history(source_event_key);

-- Aggregated experience/self-model rows do not become one-row-per-event.
-- Instead they remember the last applied event so a retry cannot advance
-- cumulative counters twice.
alter table public.james_experiences
  add column if not exists last_source_event_key text;

alter table public.james_experience_consolidations
  add column if not exists last_source_event_key text;

alter table public.james_self_model
  add column if not exists last_source_event_key text;

comment on column public.james_reflections.source_event_key is
  'Deterministic learning event identity, normally fun-zone:<experiment_id>:<attempt>.';

comment on column public.james_self_evaluations.source_event_key is
  'Deterministic learning event identity, normally fun-zone:<experiment_id>:<attempt>.';

comment on column public.james_capability_mastery_history.source_event_key is
  'Deterministic learning event identity, normally fun-zone:<experiment_id>:<attempt>:<capability>.';

comment on column public.james_experiences.last_source_event_key is
  'Last learning event applied to this aggregate experience row.';

comment on column public.james_experience_consolidations.last_source_event_key is
  'Last learning event applied to this aggregate consolidation row.';

comment on column public.james_self_model.last_source_event_key is
  'Last learning event applied to this aggregate self-model row.';
