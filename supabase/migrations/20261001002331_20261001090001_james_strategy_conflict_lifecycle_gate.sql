-- Integrity-aware lifecycle gate: open integrity conflicts explicitly block promotion/retirement transitions.
create or replace function public.reconcile_james_meta_strategy_lifecycle(
  p_strategy_id uuid,
  p_min_samples integer default 4,
  p_promote_score numeric default .75,
  p_retire_score numeric default .35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  e record;
  v_open integer:=0;
  v_high integer:=0;
  v_integrity_open integer:=0;
  v_min integer:=greatest(1,coalesce(p_min_samples,4));
  v_promote numeric:=greatest(0,least(1,coalesce(p_promote_score,.75)));
  v_retire numeric:=greatest(0,least(v_promote,coalesce(p_retire_score,.35)));
  v_score numeric:=0;
  v_next text;
  v_reason text;
  v_fp text;
  v_event uuid;
  v_changed boolean:=false;
begin
  select id,task_class,status,evidence_count,success_count,failure_count,confidence
    into s
    from public.james_meta_strategies
   where id=p_strategy_id
   for update;

  if s.id is null then
    return jsonb_build_object('reconciled',false,'reason','strategy_not_found','strategyId',p_strategy_id);
  end if;

  select * into e
    from public.james_meta_strategy_evidence
   where strategy_id=p_strategy_id;

  if e.strategy_id is null then
    return jsonb_build_object('reconciled',false,'reason','evidence_not_available','strategyId',p_strategy_id,'status',s.status);
  end if;

  select
    count(*)::int,
    count(*) filter(where severity='high')::int,
    count(*) filter(where conflict_type='verification_lineage_mismatch' and resolution_state='open')::int
    into v_open,v_high,v_integrity_open
    from public.james_meta_strategy_evidence_conflicts
   where strategy_id=p_strategy_id
     and resolution_state='open';

  v_score:=greatest(0,least(1,
    coalesce(e.outcome_rate,0)*.55+
    coalesce(e.avg_quality,0)*.20+
    coalesce(e.confidence,0)*.25
  ));

  v_next:=s.status;
  v_reason:='evidence does not cross a lifecycle threshold';

  if v_integrity_open>0 then
    v_reason:='open strategy integrity conflict explicitly blocks lifecycle transition';
  elsif v_high>0 then
    v_reason:='open high-severity evidence conflict blocks lifecycle transition';
  elsif v_open>0 then
    v_reason:='open evidence conflict blocks lifecycle transition';
  elsif e.evidence_count<v_min then
    v_reason:='minimum evidence threshold not reached';
  elsif s.status='candidate' and v_score>=v_promote then
    v_next:='active';
    v_reason:='candidate met empirical promotion threshold';
  elsif s.status='active' and v_score<=v_retire then
    v_next:='retired';
    v_reason:='active strategy fell below empirical retirement threshold';
  elsif s.status='retired' then
    v_next:='retired';
    v_reason:='retired strategies remain historical evidence';
  end if;

  v_fp:=md5(jsonb_build_object(
    'strategyId',e.strategy_id,
    'evidenceCount',e.evidence_count,
    'trialCount',e.trial_count,
    'successCount',e.success_count,
    'failureCount',e.failure_count,
    'confidence',e.confidence,
    'score',v_score,
    'openConflicts',v_open,
    'highConflicts',v_high,
    'openIntegrityConflicts',v_integrity_open
  )::text);

  insert into public.james_meta_strategy_lifecycle_events(
    strategy_id,previous_status,next_status,evidence_fingerprint,evidence_snapshot,reason
  )
  values(
    s.id,s.status,v_next,v_fp,
    jsonb_build_object(
      'evidenceCount',e.evidence_count,
      'trialCount',e.trial_count,
      'outcomeRate',e.outcome_rate,
      'avgQuality',e.avg_quality,
      'confidence',e.confidence,
      'score',v_score,
      'openConflictCount',v_open,
      'highConflictCount',v_high,
      'openIntegrityConflictCount',v_integrity_open,
      'minimumSamples',v_min,
      'promoteScore',v_promote,
      'retireScore',v_retire
    ),
    v_reason
  )
  on conflict(strategy_id,evidence_fingerprint) do nothing
  returning id into v_event;

  if v_next<>s.status and v_open=0 and v_integrity_open=0 then
    update public.james_meta_strategies
       set status=v_next,updated_at=now()
     where id=s.id;
    v_changed:=true;
  end if;

  return jsonb_build_object(
    'reconciled',true,
    'changed',v_changed,
    'strategyId',s.id,
    'previousStatus',s.status,
    'status',v_next,
    'score',v_score,
    'evidenceCount',e.evidence_count,
    'confidence',e.confidence,
    'openConflictCount',v_open,
    'highConflictCount',v_high,
    'openIntegrityConflictCount',v_integrity_open,
    'reason',v_reason,
    'eventId',v_event,
    'idempotent',v_event is null
  );
end;
$$;

revoke all on function public.reconcile_james_meta_strategy_lifecycle(uuid,integer,numeric,numeric)
from public,anon,authenticated;
grant execute on function public.reconcile_james_meta_strategy_lifecycle(uuid,integer,numeric,numeric)
to service_role;
