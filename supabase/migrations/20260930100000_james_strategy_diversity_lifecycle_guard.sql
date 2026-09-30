-- Diversity-aware lifecycle guard for autonomous strategy candidates.
-- Prevents promotion when a candidate repeatedly fails to produce a structurally
-- different blueprint, while preserving legacy strategies whose older evidence
-- predates diversity telemetry.

CREATE OR REPLACE FUNCTION public.promote_retire_james_meta_strategy(
  p_strategy_id uuid,
  p_min_samples integer DEFAULT 4,
  p_promote_score numeric DEFAULT 0.75,
  p_retire_score numeric DEFAULT 0.35
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_strategy record;
  v_samples integer;
  v_score numeric;
  v_success numeric;
  v_quality numeric;
  v_comparison numeric;
  v_diversity numeric;
  v_diversity_evidence integer;
  v_new_status text;
begin
  select * into v_strategy
  from public.james_meta_strategy_synthesis
  where id=p_strategy_id
  for update;

  if v_strategy.id is null then
    return jsonb_build_object('updated',false,'reason','strategy_not_found');
  end if;

  if v_strategy.status='deprecated' then
    return jsonb_build_object('updated',false,'strategyId',p_strategy_id,'status','deprecated','reason','strategy_terminally_retired');
  end if;

  select
    count(*),
    coalesce(avg(case when outcome='success' then 1 when outcome='partial' then quality else 0 end),0),
    coalesce(avg(quality),0.5),
    avg(case when evidence->'strategyComparison'->>'improvement' is not null
      then (evidence->'strategyComparison'->>'improvement')::numeric end),
    avg(case when evidence->'blueprintDiversity'->>'mutationVerified' is not null
      then case when (evidence->'blueprintDiversity'->>'mutationVerified')::boolean then 1 else 0 end end),
    count(*) filter (where evidence->'blueprintDiversity'->>'mutationVerified' is not null)
  into v_samples,v_success,v_quality,v_comparison,v_diversity,v_diversity_evidence
  from public.james_meta_strategy_trials
  where strategy_id=p_strategy_id;

  v_score:=greatest(0,least(1,
    v_success*0.60 + v_quality*0.25 + coalesce(v_comparison,0)*0.15
  ));

  if v_diversity_evidence > 0 then
    v_score:=greatest(0,least(1,v_score * coalesce(v_diversity,0)));
  end if;

  if v_samples>=greatest(1,p_min_samples)
     and v_score>=p_promote_score
     and (v_comparison is null or v_comparison>=0)
     and (v_diversity_evidence=0 or coalesce(v_diversity,0)>=1) then
    v_new_status:='validated';
  elsif v_samples>=greatest(1,p_min_samples)
     and (v_score<=p_retire_score or coalesce(v_comparison,0)<=-0.15
       or (v_diversity_evidence>0 and coalesce(v_diversity,0)=0)) then
    v_new_status:='deprecated';
  else
    v_new_status:=v_strategy.status;
  end if;

  update public.james_meta_strategy_synthesis
  set status=v_new_status,
      confidence=greatest(0,least(0.99,v_score)),
      success_count=(select count(*) from public.james_meta_strategy_trials where strategy_id=p_strategy_id and outcome='success'),
      failure_count=(select count(*) from public.james_meta_strategy_trials where strategy_id=p_strategy_id and outcome='failure'),
      evidence_count=v_samples,
      updated_at=now()
  where id=p_strategy_id;

  return jsonb_build_object(
    'updated',v_new_status<>v_strategy.status,
    'strategyId',p_strategy_id,
    'status',v_new_status,
    'sampleCount',v_samples,
    'score',v_score,
    'successSignal',v_success,
    'quality',v_quality,
    'parentImprovement',v_comparison,
    'diversityScore',v_diversity,
    'diversityEvidenceCount',v_diversity_evidence
  );
end;
$function$;