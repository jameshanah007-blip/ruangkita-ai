-- James Strategy Synthesis Memory v1
create table if not exists public.james_meta_strategy_synthesis (
  id uuid primary key default gen_random_uuid(),
  revalidation_id uuid references public.james_meta_strategy_revalidation_queue(id) on delete set null,
  source_strategy_id uuid references public.james_meta_strategies(id) on delete set null,
  candidate_strategy_id uuid references public.james_meta_strategies(id) on delete set null,
  source_event_key text not null unique,
  task_class text not null,
  source_strategy text not null,
  synthesized_strategy text not null,
  capabilities jsonb not null default '[]'::jsonb,
  source_evidence_snapshot jsonb not null default '{}'::jsonb,
  synthesis_reason text not null default '',
  model_confidence numeric(6,4) not null default 0,
  decision text not null check (decision in ('candidate_created','duplicate_reused','blocked')),
  created_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_synthesis_source_idx
  on public.james_meta_strategy_synthesis(source_strategy_id,created_at desc);
create index if not exists james_meta_strategy_synthesis_candidate_idx
  on public.james_meta_strategy_synthesis(candidate_strategy_id,created_at desc);

alter table public.james_meta_strategy_synthesis enable row level security;

revoke all on table public.james_meta_strategy_synthesis from public,anon,authenticated;
create or replace function public.record_james_meta_strategy_synthesis(
  p_revalidation_id uuid,
  p_source_strategy_id uuid,
  p_candidate_strategy_id uuid,
  p_source_event_key text,
  p_task_class text,
  p_source_strategy text,
  p_synthesized_strategy text,
  p_capabilities jsonb,
  p_source_evidence_snapshot jsonb,
  p_synthesis_reason text,
  p_model_confidence numeric,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  if p_decision not in ('candidate_created','duplicate_reused','blocked') then
    raise exception 'invalid synthesis decision: %',p_decision;
  end if;

  insert into public.james_meta_strategy_synthesis(
    revalidation_id,source_strategy_id,candidate_strategy_id,source_event_key,
    task_class,source_strategy,synthesized_strategy,capabilities,
    source_evidence_snapshot,synthesis_reason,model_confidence,decision
  )
  values(
    p_revalidation_id,p_source_strategy_id,p_candidate_strategy_id,p_source_event_key,
    coalesce(nullif(trim(p_task_class),''),'unknown'),
    coalesce(p_source_strategy,''),
    coalesce(p_synthesized_strategy,''),
    coalesce(p_capabilities,'[]'::jsonb),
    coalesce(p_source_evidence_snapshot,'{}'::jsonb),
    coalesce(p_synthesis_reason,''),
    greatest(0,least(.99,coalesce(p_model_confidence,0))),
    p_decision
  )
  on conflict(source_event_key) do update set
    candidate_strategy_id=coalesce(excluded.candidate_strategy_id,james_meta_strategy_synthesis.candidate_strategy_id),
    decision=excluded.decision,
    created_at=james_meta_strategy_synthesis.created_at
  returning id into v_id;

  return jsonb_build_object('recorded',true,'id',v_id,'decision',p_decision);
end;
$$;

revoke all on function public.record_james_meta_strategy_synthesis(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)
from public,anon,authenticated;
grant execute on function public.record_james_meta_strategy_synthesis(uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,numeric,text)
to service_role;
