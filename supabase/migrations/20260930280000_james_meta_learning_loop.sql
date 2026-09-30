create table if not exists public.james_meta_learning_attributions (
  id uuid primary key default gen_random_uuid(),
  decision_trace_id uuid,
  outcome_id uuid,
  attribution text not null check (attribution in ('knowledge','retrieval','decision_policy','mixed','insufficient_evidence')),
  confidence numeric(5,4) not null default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  recommended_recovery text,
  created_at timestamptz not null default now()
);

create index if not exists james_meta_learning_attribution_idx
  on public.james_meta_learning_attributions(attribution,created_at desc);

alter table public.james_meta_learning_attributions enable row level security;

create or replace function public.record_james_meta_learning_attribution(
  p_decision_trace_id uuid,
  p_outcome_id uuid,
  p_attribution text,
  p_confidence numeric default 0.5,
  p_evidence jsonb default '{}'::jsonb,
  p_recommended_recovery text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_attribution not in ('knowledge','retrieval','decision_policy','mixed','insufficient_evidence') then
    raise exception 'invalid meta-learning attribution';
  end if;

  insert into public.james_meta_learning_attributions(
    decision_trace_id,outcome_id,attribution,confidence,evidence,recommended_recovery
  )
  values(
    p_decision_trace_id,p_outcome_id,p_attribution,
    greatest(0,least(1,coalesce(p_confidence,0.5))),
    coalesce(p_evidence,'{}'::jsonb),
    p_recommended_recovery
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_james_meta_learning_attribution(
  uuid,uuid,text,numeric,jsonb,text
) from public,anon,authenticated;
grant execute on function public.record_james_meta_learning_attribution(
  uuid,uuid,text,numeric,jsonb,text
) to service_role;
