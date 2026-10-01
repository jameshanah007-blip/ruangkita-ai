-- Integrity recovery loop: resolved integrity conflicts remain historical while
-- active trust penalties are recalculated from currently open high-severity conflicts.
create or replace function public.recover_james_meta_strategy_integrity(
  p_strategy_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_high integer:=0;
  v_open_total integer:=0;
  v_resolved integer:=0;
  v_trust numeric:=0;
  v_lineage numeric:=0;
  v_confidence numeric:=0;
  v_evidence_count integer:=0;
begin
  select
    count(*) filter(where resolution_state='open')::int,
    count(*) filter(where resolution_state='open' and severity='high')::int,
    count(*) filter(where resolution_state='resolved')::int
    into v_open_total,v_open_high,v_resolved
    from public.james_meta_strategy_evidence_conflicts
   where strategy_id=p_strategy_id;

  select
    greatest(0,least(1,coalesce(trust_score,0))),
    greatest(0,least(1,coalesce(lineage_completeness,0))),
    greatest(0,least(1,coalesce(confidence,0))),
    coalesce(evidence_count,0)
    into v_trust,v_lineage,v_confidence,v_evidence_count
    from public.james_meta_strategy_evidence
   where strategy_id=p_strategy_id;

  -- Recalculate active penalty only from unresolved high-severity conflicts.
  -- Resolved conflicts remain in conflict_count as historical evidence.
  v_trust:=greatest(0,v_trust-(least(1,v_open_high::numeric*0.25)));
  v_lineage:=greatest(0,v_lineage-(least(1,v_open_high::numeric*0.20)));

  update public.james_meta_strategy_evidence
     set trust_score=v_trust,
         lineage_completeness=v_lineage,
         integrity_conflict_count=(
           select count(*)::int
             from public.james_meta_strategy_evidence_conflicts
            where strategy_id=p_strategy_id
         ),
         integrity_conflict_score=least(1,v_open_high::numeric/4),
         evidence=jsonb_set(
           jsonb_set(
             jsonb_set(
               coalesce(evidence,'{}'::jsonb),
               '{integrityRecovery}',
               jsonb_build_object(
                 'openConflictCount',v_open_total,
                 'openHighConflictCount',v_open_high,
                 'resolvedConflictCount',v_resolved,
                 'trustRecovered',v_trust,
                 'lineageRecovered',v_lineage,
                 'recoveredAt',now()
               ),
               true
             ),
             '{trustScore}',to_jsonb(v_trust),true
           ),
           '{lineageCompleteness}',to_jsonb(v_lineage),true
         ),
         refreshed_at=now()
   where strategy_id=p_strategy_id;

  return jsonb_build_object(
    'recovered',true,
    'strategyId',p_strategy_id,
    'openConflictCount',v_open_total,
    'openHighConflictCount',v_open_high,
    'resolvedConflictCount',v_resolved,
    'trustScore',v_trust,
    'lineageCompleteness',v_lineage,
    'evidenceCount',v_evidence_count,
    'confidence',v_confidence
  );
end;
$$;

create or replace function public.recover_all_james_meta_strategy_integrity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_total integer:=0;
begin
  for s in select id from public.james_meta_strategies loop
    perform public.recover_james_meta_strategy_integrity(s.id);
    v_total:=v_total+1;
  end loop;

  return jsonb_build_object('recoveredStrategies',v_total,'recoveredAt',now());
end;
$$;

revoke all on function public.recover_james_meta_strategy_integrity(uuid)
from public,anon,authenticated;
revoke all on function public.recover_all_james_meta_strategy_integrity()
from public,anon,authenticated;
grant execute on function public.recover_james_meta_strategy_integrity(uuid) to service_role;
grant execute on function public.recover_all_james_meta_strategy_integrity() to service_role;
