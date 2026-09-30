create table if not exists public.james_knowledge_provenance (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null,
  knowledge_source text not null check (knowledge_source in ('consolidation','experience')),
  event_type text not null check (event_type in (
    'created','feedback','recalibrated','aged','revalidated',
    'conflict_detected','conflict_resolved','rejected','promoted'
  )),
  source_id uuid,
  source_type text,
  parent_knowledge_id uuid,
  parent_knowledge_source text,
  confidence_before numeric(5,4),
  confidence_after numeric(5,4),
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_knowledge_provenance_lookup_idx
  on public.james_knowledge_provenance(knowledge_id, knowledge_source, created_at desc);

create index if not exists james_knowledge_provenance_source_idx
  on public.james_knowledge_provenance(source_id, source_type, created_at desc);

alter table public.james_knowledge_provenance enable row level security;

create or replace function public.record_james_knowledge_provenance(
  p_knowledge_id uuid,
  p_knowledge_source text,
  p_event_type text,
  p_source_id uuid default null,
  p_source_type text default null,
  p_parent_knowledge_id uuid default null,
  p_parent_knowledge_source text default null,
  p_confidence_before numeric default null,
  p_confidence_after numeric default null,
  p_evidence jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_knowledge_source not in ('consolidation','experience') then
    raise exception 'unsupported knowledge source';
  end if;

  insert into public.james_knowledge_provenance (
    knowledge_id, knowledge_source, event_type, source_id, source_type,
    parent_knowledge_id, parent_knowledge_source,
    confidence_before, confidence_after, evidence, metadata
  )
  values (
    p_knowledge_id, p_knowledge_source, p_event_type, p_source_id, p_source_type,
    p_parent_knowledge_id, p_parent_knowledge_source,
    p_confidence_before, p_confidence_after,
    coalesce(p_evidence,'{}'::jsonb), coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_james_knowledge_provenance(
  uuid,text,text,uuid,text,uuid,text,numeric,numeric,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.record_james_knowledge_provenance(
  uuid,text,text,uuid,text,uuid,text,numeric,numeric,jsonb,jsonb
) to service_role;
