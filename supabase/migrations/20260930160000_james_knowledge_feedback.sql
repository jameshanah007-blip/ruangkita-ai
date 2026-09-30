create table if not exists public.james_knowledge_feedback (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null,
  knowledge_source text not null check (knowledge_source in ('consolidation','experience')),
  task text not null,
  outcome text not null check (outcome in ('success','failure','partial','unknown')),
  quality numeric(5,4) not null default 0.5,
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_knowledge_feedback_lookup_idx
  on public.james_knowledge_feedback(knowledge_id, created_at desc);

alter table public.james_knowledge_feedback enable row level security;

create or replace function public.record_james_knowledge_feedback(
  p_knowledge_id uuid,
  p_knowledge_source text,
  p_task text,
  p_outcome text,
  p_quality numeric,
  p_evidence jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.james_knowledge_feedback(
    knowledge_id, knowledge_source, task, outcome, quality, evidence
  )
  values (
    p_knowledge_id,
    p_knowledge_source,
    left(p_task, 1000),
    p_outcome,
    greatest(0, least(1, coalesce(p_quality, 0.5))),
    p_evidence
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_james_knowledge_feedback(uuid,text,text,text,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.record_james_knowledge_feedback(uuid,text,text,text,numeric,jsonb) to service_role;
