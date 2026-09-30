create table if not exists public.james_knowledge_lifecycle (
  knowledge_id uuid not null,
  knowledge_source text not null check (knowledge_source in ('consolidation','experience')),
  state text not null default 'active' check (state in ('active','aging','stale','revalidating','trusted','rejected')),
  confidence numeric(5,4) not null default 0.5,
  last_transition_at timestamptz not null default now(),
  last_reason text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (knowledge_id, knowledge_source)
);

create index if not exists james_knowledge_lifecycle_state_idx
  on public.james_knowledge_lifecycle(state, updated_at desc);

alter table public.james_knowledge_lifecycle enable row level security;

create or replace function public.transition_james_knowledge_lifecycle(
  p_knowledge_id uuid,
  p_knowledge_source text,
  p_event text,
  p_confidence numeric default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
  v_confidence numeric;
  v_next text;
begin
  if p_knowledge_source not in ('consolidation','experience') then
    raise exception 'unsupported knowledge source';
  end if;

  select state, confidence
    into v_state, v_confidence
  from public.james_knowledge_lifecycle
  where knowledge_id=p_knowledge_id and knowledge_source=p_knowledge_source
  for update;

  if v_state is null then
    v_state := 'active';
    v_confidence := greatest(0, least(1, coalesce(p_confidence, 0.5)));
  end if;

  v_next := case
    when p_event='created' then 'active'
    when p_event='aging' then 'aging'
    when p_event='stale' then 'stale'
    when p_event='revalidation_started' then 'revalidating'
    when p_event='revalidation_success' and coalesce(p_confidence,v_confidence) >= 0.70 then 'trusted'
    when p_event='revalidation_success' then 'active'
    when p_event='revalidation_partial' then 'aging'
    when p_event='revalidation_failure' then 'rejected'
    when p_event='reactivate' then 'active'
    else v_state
  end;

  insert into public.james_knowledge_lifecycle
    (knowledge_id, knowledge_source, state, confidence, last_transition_at, last_reason, metadata, updated_at)
  values
    (p_knowledge_id, p_knowledge_source, v_next,
     greatest(0, least(1, coalesce(p_confidence,v_confidence))),
     now(), p_reason, coalesce(p_metadata,'{}'::jsonb), now())
  on conflict (knowledge_id, knowledge_source)
  do update set
    state=excluded.state,
    confidence=excluded.confidence,
    last_transition_at=excluded.last_transition_at,
    last_reason=excluded.last_reason,
    metadata=excluded.metadata,
    updated_at=excluded.updated_at;

  return jsonb_build_object(
    'knowledgeId', p_knowledge_id,
    'knowledgeSource', p_knowledge_source,
    'previousState', v_state,
    'state', v_next,
    'confidence', greatest(0, least(1, coalesce(p_confidence,v_confidence))),
    'event', p_event
  );
end;
$$;

revoke all on function public.transition_james_knowledge_lifecycle(uuid,text,text,numeric,text,jsonb)
from public, anon, authenticated;
grant execute on function public.transition_james_knowledge_lifecycle(uuid,text,text,numeric,text,jsonb)
to service_role;
