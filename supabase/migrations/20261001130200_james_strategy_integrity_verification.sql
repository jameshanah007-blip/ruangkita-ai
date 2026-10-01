-- Strategy integrity verification: selected, executed, and verified usage must bind to one strategy fingerprint.
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
   where experiment_id=p_experiment_id and attempt=greatest(coalesce(p_attempt,0),0)
     and strategy_id=p_strategy_id and usage_state='selected'
   order by created_at desc limit 1;

  select * into v_executed
    from public.james_meta_strategy_usage
   where experiment_id=p_experiment_id and attempt=greatest(coalesce(p_attempt,0),0)
     and strategy_id=p_strategy_id and usage_state='executed'
   order by created_at desc limit 1;

  select * into v_verified
    from public.james_meta_strategy_usage
   where experiment_id=p_experiment_id and attempt=greatest(coalesce(p_attempt,0),0)
     and strategy_id=p_strategy_id and usage_state='verified'
   order by created_at desc limit 1;

  select md5(jsonb_build_object(
    'id',s.id,'taskClass',s.task_class,'strategy',s.strategy,
    'capabilities',s.capabilities,'confidence',s.confidence,
    'evidenceCount',s.evidence_count,'status',s.status
  )::text) into v_expected
    from public.james_meta_strategies s where s.id=p_strategy_id;

  if v_expected is null then
    raise exception 'Strategy integrity verification failed: strategy not found';
  end if;

  return jsonb_build_object(
    'ok',
      v_selected.strategy_fingerprint is not null
      and v_executed.strategy_fingerprint = v_selected.strategy_fingerprint
      and v_verified.strategy_fingerprint = v_selected.strategy_fingerprint
      and v_selected.strategy_fingerprint = v_expected,
    'expectedFingerprint',v_expected,
    'selectedFingerprint',v_selected.strategy_fingerprint,
    'executedFingerprint',v_executed.strategy_fingerprint,
    'verifiedFingerprint',v_verified.strategy_fingerprint,
    'selectedPresent',v_selected.id is not null,
    'executedPresent',v_executed.id is not null,
    'verifiedPresent',v_verified.id is not null
  );
end;
$$;

revoke all on function public.verify_james_meta_strategy_integrity(uuid,uuid,uuid)
from public, anon, authenticated;
grant execute on function public.verify_james_meta_strategy_integrity(uuid,uuid,uuid)
to service_role;

-- Backfill selected usage from experiment attribution is intentionally omitted:
-- historical rows may not have an immutable strategy snapshot and must not be
-- retroactively treated as integrity-verified.
