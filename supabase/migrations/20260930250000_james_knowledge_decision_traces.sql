create table if not exists public.james_knowledge_decision_traces (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  selected_knowledge_id uuid,
  selected_knowledge_source text,
  decision text not null check (decision in ('selected','rejected','verify','unresolved','insufficient_evidence')),
  factors jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  explanation text not null,
  created_at timestamptz not null default now()
);

create index if not exists james_knowledge_decision_traces_task_idx
  on public.james_knowledge_decision_traces(task,created_at desc);

alter table public.james_knowledge_decision_traces enable row level security;

create or replace function public.record_james_knowledge_decision_trace(
  p_task text,
  p_selected_knowledge_id uuid,
  p_selected_knowledge_source text,
  p_decision text,
  p_factors jsonb,
  p_evidence_refs jsonb,
  p_explanation text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_decision not in ('selected','rejected','verify','unresolved','insufficient_evidence') then
    raise exception 'invalid knowledge decision';
  end if;

  insert into public.james_knowledge_decision_traces(
    task,selected_knowledge_id,selected_knowledge_source,
    decision,factors,evidence_refs,explanation
  )
  values(
    p_task,p_selected_knowledge_id,p_selected_knowledge_source,
    p_decision,coalesce(p_factors,'{}'::jsonb),
    coalesce(p_evidence_refs,'[]'::jsonb),p_explanation
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_james_knowledge_decision_trace(
  text,uuid,text,text,jsonb,jsonb,text
) from public,anon,authenticated;
grant execute on function public.record_james_knowledge_decision_trace(
  text,uuid,text,text,jsonb,jsonb,text
) to service_role;
