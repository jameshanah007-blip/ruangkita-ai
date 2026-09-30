create table if not exists public.james_knowledge_decision_outcomes (
  id uuid primary key default gen_random_uuid(),
  decision_trace_id uuid not null,
  outcome text not null check (outcome in ('success','failure','partial','unknown')),
  quality numeric(5,4) not null default 0.5,
  expected boolean,
  error_type text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_knowledge_decision_outcomes_trace_idx
  on public.james_knowledge_decision_outcomes(decision_trace_id, created_at desc);

create index if not exists james_knowledge_decision_outcomes_outcome_idx
  on public.james_knowledge_decision_outcomes(outcome, created_at desc);

alter table public.james_knowledge_decision_outcomes enable row level security;

create or replace function public.record_james_decision_outcome(
  p_decision_trace_id uuid,
  p_outcome text,
  p_quality numeric default 0.5,
  p_expected boolean default null,
  p_error_type text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_outcome not in ('success','failure','partial','unknown') then
    raise exception 'invalid decision outcome';
  end if;

  insert into public.james_knowledge_decision_outcomes(
    decision_trace_id,outcome,quality,expected,error_type,evidence
  )
  values(
    p_decision_trace_id,
    p_outcome,
    greatest(0,least(1,coalesce(p_quality,0.5))),
    p_expected,
    p_error_type,
    coalesce(p_evidence,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_james_decision_outcome(
  uuid,text,numeric,boolean,text,jsonb
) from public,anon,authenticated;
grant execute on function public.record_james_decision_outcome(
  uuid,text,numeric,boolean,text,jsonb
) to service_role;
