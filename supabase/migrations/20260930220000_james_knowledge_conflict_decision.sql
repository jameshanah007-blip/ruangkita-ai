create table if not exists public.james_knowledge_decision_conflicts (
  id uuid primary key default gen_random_uuid(),
  capability text not null,
  context_key text not null,
  candidate_a jsonb not null,
  candidate_b jsonb not null,
  score_a numeric(8,6) not null,
  score_b numeric(8,6) not null,
  decision text not null check (decision in ('candidate_a','candidate_b','unresolved','verify')),
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists james_knowledge_decision_conflicts_lookup_idx
  on public.james_knowledge_decision_conflicts(capability, context_key, created_at desc);

alter table public.james_knowledge_decision_conflicts enable row level security;

create or replace function public.record_james_knowledge_conflict(
  p_capability text,
  p_context_key text,
  p_candidate_a jsonb,
  p_candidate_b jsonb,
  p_score_a numeric,
  p_score_b numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gap numeric := abs(coalesce(p_score_a,0) - coalesce(p_score_b,0));
  v_decision text;
  v_reason text;
  v_id uuid;
begin
  if v_gap < 0.08 then
    v_decision := 'unresolved';
    v_reason := 'Evidence gap is too small to justify selecting one candidate.';
  elsif greatest(coalesce(p_score_a,0),coalesce(p_score_b,0)) < 0.60 then
    v_decision := 'verify';
    v_reason := 'The leading candidate does not meet the minimum confidence threshold.';
  elsif p_score_a > p_score_b then
    v_decision := 'candidate_a';
    v_reason := 'Candidate A has materially stronger evidence.';
  else
    v_decision := 'candidate_b';
    v_reason := 'Candidate B has materially stronger evidence.';
  end if;

  insert into public.james_knowledge_decision_conflicts
    (capability,context_key,candidate_a,candidate_b,score_a,score_b,decision,reason)
  values
    (p_capability,p_context_key,p_candidate_a,p_candidate_b,
     coalesce(p_score_a,0),coalesce(p_score_b,0),v_decision,v_reason)
  returning id into v_id;

  return jsonb_build_object(
    'id',v_id,'decision',v_decision,'scoreGap',v_gap,'reason',v_reason
  );
end;
$$;

revoke all on function public.record_james_knowledge_conflict(text,text,jsonb,jsonb,numeric,numeric)
from public, anon, authenticated;
grant execute on function public.record_james_knowledge_conflict(text,text,jsonb,jsonb,numeric,numeric)
to service_role;
