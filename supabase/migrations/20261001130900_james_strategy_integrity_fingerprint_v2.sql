-- Strategy integrity fingerprint v2
-- Immutable strategy identity is separated from mutable evidence/lifecycle counters.

alter table public.james_meta_strategy_usage
  add column if not exists strategy_identity_fingerprint text;

create index if not exists james_meta_strategy_usage_identity_fingerprint_idx
  on public.james_meta_strategy_usage(strategy_id,strategy_identity_fingerprint);

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
  v_legacy_fingerprint text;
  v_identity_fingerprint text;
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

  v_identity_fingerprint := md5(jsonb_build_object(
    'fingerprintVersion', 2,
    'id', v_strategy.id,
    'taskClass', v_strategy.task_class,
    'strategy', v_strategy.strategy,
    'capabilities', v_strategy.capabilities
  )::text);

  v_legacy_fingerprint := md5(jsonb_build_object(
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
    strategy_fingerprint, strategy_identity_fingerprint, evidence
  )
  values (
    p_strategy_id, p_experiment_id, greatest(coalesce(p_attempt,0),0),
    p_usage_state, v_key, v_legacy_fingerprint, v_identity_fingerprint,
    coalesce(p_evidence,'{}'::jsonb) ||
      jsonb_build_object(
        'strategyFingerprint',v_legacy_fingerprint,
        'strategyIdentityFingerprint',v_identity_fingerprint,
        'strategyFingerprintVersion',2
      )
  )
  on conflict (source_event_key) do update
    set evidence = excluded.evidence,
        strategy_fingerprint = excluded.strategy_fingerprint,
        strategy_identity_fingerprint = excluded.strategy_identity_fingerprint
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.verify_james_meta_strategy_integrity(
  p_experiment_id uuid,
  p_attempt integer,
  p_strategy_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_selected record;
  v_executed record;
  v_verified record;
  v_expected text;
begin
  select * into v_selected
    from public.james_meta_strategy_usage
   where experiment_id=p_experiment_id
     and attempt=greatest(coalesce(p_attempt,0),0)
     and strategy_id=p_strategy_id
     and usage_state='selected'
   order by created_at desc limit 1;

  select * into v_executed
    from public.james_meta_strategy_usage
   where experiment_id=p_experiment_id
     and attempt=greatest(coalesce(p_attempt,0),0)
     and strategy_id=p_strategy_id
     and usage_state='executed'
   order by created_at desc limit 1;

  select * into v_verified
    from public.james_meta_strategy_usage
   where experiment_id=p_experiment_id
     and attempt=greatest(coalesce(p_attempt,0),0)
     and strategy_id=p_strategy_id
     and usage_state='verified'
   order by created_at desc limit 1;

  select md5(jsonb_build_object(
    'fingerprintVersion', 2,
    'id',s.id,
    'taskClass',s.task_class,
    'strategy',s.strategy,
    'capabilities',s.capabilities
  )::text)
    into v_expected
    from public.james_meta_strategies s
   where s.id=p_strategy_id;

  if v_expected is null then
    raise exception 'Strategy integrity verification failed: strategy not found';
  end if;

  return jsonb_build_object(
    'ok',
      v_selected.strategy_identity_fingerprint is not null
      and v_executed.strategy_identity_fingerprint = v_selected.strategy_identity_fingerprint
      and v_verified.strategy_identity_fingerprint = v_selected.strategy_identity_fingerprint
      and v_selected.strategy_identity_fingerprint = v_expected,
    'fingerprintVersion',2,
    'expectedFingerprint',v_expected,
    'selectedFingerprint',v_selected.strategy_identity_fingerprint,
    'executedFingerprint',v_executed.strategy_identity_fingerprint,
    'verifiedFingerprint',v_verified.strategy_identity_fingerprint,
    'selectedPresent',v_selected.id is not null,
    'executedPresent',v_executed.id is not null,
    'verifiedPresent',v_verified.id is not null
  );
end;
$$;

revoke all on function public.record_james_meta_strategy_usage(uuid,uuid,integer,text,jsonb)
from public, anon, authenticated;
grant execute on function public.record_james_meta_strategy_usage(uuid,uuid,integer,text,jsonb)
to service_role;

revoke all on function public.verify_james_meta_strategy_integrity(uuid,integer,uuid)
from public, anon, authenticated;
grant execute on function public.verify_james_meta_strategy_integrity(uuid,integer,uuid)
to service_role;
