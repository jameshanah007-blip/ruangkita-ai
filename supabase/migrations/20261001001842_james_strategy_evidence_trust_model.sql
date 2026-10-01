-- Evidence Trust Model v3: provenance-backed trust becomes part of derived confidence.
alter table public.james_meta_strategy_evidence
  add column if not exists provenance_count integer not null default 0,
  add column if not exists verified_provenance_count integer not null default 0,
  add column if not exists orphan_evidence_count integer not null default 0,
  add column if not exists provenance_coverage numeric not null default 0,
  add column if not exists execution_coverage numeric not null default 0,
  add column if not exists verification_coverage numeric not null default 0,
  add column if not exists lineage_completeness numeric not null default 0,
  add column if not exists trust_score numeric not null default 0;

drop function if exists public.refresh_james_meta_strategy_evidence(uuid);

create function public.refresh_james_meta_strategy_evidence(p_strategy_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record; t record; c record; m record;
  v_selected integer:=0; v_executed integer:=0; v_verified integer:=0;
  v_prov integer:=0; v_verified_prov integer:=0; v_orphan integer:=0;
  v_exec_rate numeric:=0; v_verify_rate numeric:=0;
  v_prov_cov numeric:=0; v_exec_cov numeric:=0; v_verify_cov numeric:=0;
  v_lineage numeric:=0; v_trust numeric:=0; v_confidence numeric:=0;
  v_evidence_count integer:=0;
begin
  select id,task_class into s from public.james_meta_strategies where id=p_strategy_id;
  if s.id is null then return jsonb_build_object('refreshed',false,'reason','strategy_not_found','strategyId',p_strategy_id); end if;

  select count(*)::int trial_count,
    count(*) filter(where outcome='success')::int success_count,
    count(*) filter(where outcome='failure')::int failure_count,
    count(*) filter(where outcome='partial')::int partial_count,
    count(*) filter(where outcome='unknown')::int unknown_count,
    coalesce(avg(quality),0)::numeric avg_quality,
    coalesce(avg(case when outcome='success' then 1 when outcome='partial' then quality else 0 end),0)::numeric outcome_rate
  into t from public.james_meta_strategy_trials where strategy_id=p_strategy_id;

  select count(*)::int comparison_count,
    count(*) filter(where case when evidence->'strategyComparison'->>'improvement' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (evidence->'strategyComparison'->>'improvement')::numeric else 0 end > 0)::int comparison_improved,
    coalesce(avg(case when evidence->'strategyComparison'->>'improvement' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (evidence->'strategyComparison'->>'improvement')::numeric end),0)::numeric avg_improvement
  into c from public.james_meta_strategy_trials
  where strategy_id=p_strategy_id and evidence ? 'strategyComparison';

  select count(*)::int tournament_count,
    count(*) filter(where role='winner')::int tournament_wins,
    coalesce(avg(score),0)::numeric avg_score,
    coalesce(avg(confidence),0)::numeric avg_confidence
  into m from public.james_meta_strategy_tournament_memory where strategy_id=p_strategy_id;

  select count(*) filter(where usage_state='selected')::int,
    count(*) filter(where usage_state='executed')::int,
    count(*) filter(where usage_state='verified')::int
  into v_selected,v_executed,v_verified
  from public.james_meta_strategy_usage where strategy_id=p_strategy_id;

  v_exec_rate:=case when v_selected>0 then least(1,v_executed::numeric/v_selected) else 0 end;
  v_verify_rate:=case when v_executed>0 then least(1,v_verified::numeric/v_executed) else 0 end;

  select count(*)::int,
    count(*) filter(where source_type='verification' and usage_id is not null and experiment_id is not null and trial_id is not null)::int
  into v_prov,v_verified_prov
  from public.james_meta_strategy_evidence_provenance where strategy_id=p_strategy_id;

  v_orphan:=greatest(0,coalesce(t.trial_count,0)-v_verified_prov);
  v_prov_cov:=case when coalesce(t.trial_count,0)>0 then least(1,v_verified_prov::numeric/t.trial_count) else 0 end;
  v_exec_cov:=case when coalesce(t.trial_count,0)>0 then least(1,v_executed::numeric/t.trial_count) else 0 end;
  v_verify_cov:=case when coalesce(t.trial_count,0)>0 then least(1,v_verified::numeric/t.trial_count) else 0 end;
  v_lineage:=least(1,v_prov_cov*0.50+v_exec_cov*0.25+v_verify_cov*0.25);
  v_trust:=v_lineage;

  v_confidence:=least(1,greatest(0,
    coalesce(t.outcome_rate,0)*0.405+
    least(1,greatest(0,coalesce(t.avg_quality,0)))*0.135+
    least(1,greatest(0,coalesce(c.avg_improvement,0)))*0.09+
    least(1,greatest(0,coalesce(m.avg_confidence,0)))*0.135+
    v_exec_rate*0.09+v_verify_rate*0.045+v_trust*0.10
  ));
  v_evidence_count:=coalesce(t.trial_count,0)+coalesce(m.tournament_count,0)+v_verified;

  insert into public.james_meta_strategy_evidence(
    strategy_id,task_class,trial_count,success_count,failure_count,partial_count,unknown_count,avg_quality,outcome_rate,
    comparison_count,comparison_improved_count,avg_comparison_improvement,tournament_count,tournament_win_count,
    avg_tournament_score,avg_tournament_confidence,confidence,evidence_count,selected_count,executed_count,
    verified_usage_count,execution_rate,verification_rate,provenance_count,verified_provenance_count,
    orphan_evidence_count,provenance_coverage,execution_coverage,verification_coverage,lineage_completeness,trust_score,evidence,refreshed_at
  ) values(
    p_strategy_id,s.task_class,coalesce(t.trial_count,0),coalesce(t.success_count,0),coalesce(t.failure_count,0),
    coalesce(t.partial_count,0),coalesce(t.unknown_count,0),least(1,greatest(0,coalesce(t.avg_quality,0))),
    least(1,greatest(0,coalesce(t.outcome_rate,0))),coalesce(c.comparison_count,0),coalesce(c.comparison_improved,0),
    greatest(-1,least(1,coalesce(c.avg_improvement,0))),coalesce(m.tournament_count,0),coalesce(m.tournament_wins,0),
    least(1,greatest(0,coalesce(m.avg_score,0))),least(1,greatest(0,coalesce(m.avg_confidence,0))),v_confidence,v_evidence_count,
    v_selected,v_executed,v_verified,v_exec_rate,v_verify_rate,v_prov,v_verified_prov,v_orphan,v_prov_cov,v_exec_cov,
    v_verify_cov,v_lineage,v_trust,jsonb_build_object(
      'strategyId',p_strategy_id,'aggregationVersion',3,'provenanceCount',v_prov,
      'verifiedProvenanceCount',v_verified_prov,'orphanEvidenceCount',v_orphan,
      'provenanceCoverage',v_prov_cov,'executionCoverage',v_exec_cov,
      'verificationCoverage',v_verify_cov,'lineageCompleteness',v_lineage,'trustScore',v_trust,
      'confidence',v_confidence,'refreshedAt',now()
    ),now()
  ) on conflict(strategy_id) do update set
    task_class=excluded.task_class,trial_count=excluded.trial_count,success_count=excluded.success_count,
    failure_count=excluded.failure_count,partial_count=excluded.partial_count,unknown_count=excluded.unknown_count,
    avg_quality=excluded.avg_quality,outcome_rate=excluded.outcome_rate,comparison_count=excluded.comparison_count,
    comparison_improved_count=excluded.comparison_improved_count,avg_comparison_improvement=excluded.avg_comparison_improvement,
    tournament_count=excluded.tournament_count,tournament_win_count=excluded.tournament_win_count,
    avg_tournament_score=excluded.avg_tournament_score,avg_tournament_confidence=excluded.avg_tournament_confidence,
    confidence=excluded.confidence,evidence_count=excluded.evidence_count,selected_count=excluded.selected_count,
    executed_count=excluded.executed_count,verified_usage_count=excluded.verified_usage_count,
    execution_rate=excluded.execution_rate,verification_rate=excluded.verification_rate,
    provenance_count=excluded.provenance_count,verified_provenance_count=excluded.verified_provenance_count,
    orphan_evidence_count=excluded.orphan_evidence_count,provenance_coverage=excluded.provenance_coverage,
    execution_coverage=excluded.execution_coverage,verification_coverage=excluded.verification_coverage,
    lineage_completeness=excluded.lineage_completeness,trust_score=excluded.trust_score,
    evidence=excluded.evidence,refreshed_at=excluded.refreshed_at;

  update public.james_meta_strategies set evidence_count=v_evidence_count,
    success_count=coalesce(t.success_count,0),failure_count=coalesce(t.failure_count,0),
    confidence=v_confidence,updated_at=now() where id=p_strategy_id;

  return jsonb_build_object('refreshed',true,'strategyId',p_strategy_id,'confidence',v_confidence,'trustScore',v_trust,'evidenceCount',v_evidence_count);
end;
$$;

create or replace function public.refresh_james_meta_strategy_evidence_provenance_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_james_meta_strategy_evidence(coalesce(new.strategy_id,old.strategy_id));
  return coalesce(new,old);
end; $$;

drop trigger if exists james_meta_strategy_evidence_provenance_refresh on public.james_meta_strategy_evidence_provenance;
create trigger james_meta_strategy_evidence_provenance_refresh
after insert or update or delete on public.james_meta_strategy_evidence_provenance
for each row execute function public.refresh_james_meta_strategy_evidence_provenance_trigger();

revoke all on function public.refresh_james_meta_strategy_evidence_provenance_trigger() from public,anon,authenticated;
grant execute on function public.refresh_james_meta_strategy_evidence_provenance_trigger() to service_role;
revoke all on function public.refresh_james_meta_strategy_evidence(uuid) from public,anon,authenticated;
grant execute on function public.refresh_james_meta_strategy_evidence(uuid) to service_role;
