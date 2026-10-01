-- Strategy integrity fingerprint: bind execution evidence to the exact strategy payload observed by the database.
alter table public.james_meta_strategy_usage
  add column if not exists strategy_fingerprint text;

create index if not exists james_meta_strategy_usage_fingerprint_idx
  on public.james_meta_strategy_usage(strategy_id,strategy_fingerprint);

create or replace function public.record_james_meta_strategy_usage(
  p_strategy_id uuid,
  p_experiment_id uuid,
  p_attempt integer,
  p_usage_state text,
  p_evidence jsonb default '{}'::jsonb
)
returns public.james_meta_strategy_usage
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.james_meta_strategy_usage;
  v_key text;
  v_strategy record;
  v_fingerprint text;
begin
  if p_usage_state not in ('selected','executed','verified') then
    raise exception 'Invalid strategy usage state';
  end if;

  select id, task_class, strategy, capabilities, confidence, evidence_count, status
    into v_strategy
    from public.james_meta_strategies
   where id = p_strategy_id;

  if v_strategy.id is null then
    raise exception 'Strategy not found';
  end if;

  v_fingerprint := md5(jsonb_build_object(
    'id', v_strategy.id,
    'taskClass', v_strategy.task_class,
    'strategy', v_strategy.strategy,
    'capabilities', v_strategy.capabilities,
    'confidence', v_strategy.confidence,
    'evidenceCount', v_strategy.evidence_count,
    'status', v_strategy.status
  )::text);

  v_key := p_experiment_id::text || ':' || p_strategy_id::text || ':' ||
    greatest(coalesce(p_attempt,0),0)::text || ':' || p_usage_state;

  insert into public.james_meta_strategy_usage(
    strategy_id, experiment_id, attempt, usage_state, source_event_key,
    strategy_fingerprint, evidence
  )
  values (
    p_strategy_id, p_experiment_id, greatest(coalesce(p_attempt,0),0),
    p_usage_state, v_key, v_fingerprint,
    coalesce(p_evidence,'{}'::jsonb) ||
      jsonb_build_object('strategyFingerprint',v_fingerprint)
  )
  on conflict (source_event_key) do update
    set evidence = excluded.evidence,
        strategy_fingerprint = excluded.strategy_fingerprint
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_james_meta_strategy_usage(uuid,uuid,integer,text,jsonb)
from public, anon, authenticated;
grant execute on function public.record_james_meta_strategy_usage(uuid,uuid,integer,text,jsonb)
to service_role;
