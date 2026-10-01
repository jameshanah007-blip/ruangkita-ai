-- Integrity conflicts directly affect derived evidence trust and strategy lineage.
alter table public.james_meta_strategy_evidence
  add column if not exists integrity_conflict_count integer not null default 0,
  add column if not exists integrity_conflict_score numeric not null default 0;

create or replace function public.refresh_james_meta_strategy_integrity_trust(p_strategy_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicts integer:=0;
  v_open_high integer:=0;
  v_trust numeric:=0;
  v_lineage numeric:=0;
begin
  select count(*)::int,
         count(*) filter(where resolution_state='open' and severity='high')::int
    into v_conflicts,v_open_high
    from public.james_meta_strategy_evidence_conflicts
   where strategy_id=p_strategy_id;

  select least(1,greatest(0,coalesce(trust_score,0))),
         least(1,greatest(0,coalesce(lineage_completeness,0)))
    into v_trust,v_lineage
    from public.james_meta_strategy_evidence
   where strategy_id=p_strategy_id;

  v_trust:=greatest(0,v_trust-(least(1,v_open_high::numeric*0.25)));
  v_lineage:=greatest(0,v_lineage-(least(1,v_open_high::numeric*0.20)));

  insert into public.james_meta_strategy_evidence(
    strategy_id,task_class,integrity_conflict_count,integrity_conflict_score,trust_score,lineage_completeness,evidence
  )
  select p_strategy_id,s.task_class,v_conflicts,least(1,v_open_high::numeric/4),v_trust,v_lineage,
    coalesce(e.evidence,'{}'::jsonb) ||
    jsonb_build_object('integrityConflictCount',v_conflicts,'openHighIntegrityConflicts',v_open_high,
      'integrityTrustPenalty',least(1,v_open_high::numeric*0.25),
      'integrityLineagePenalty',least(1,v_open_high::numeric*0.20),'integrityRefreshedAt',now())
    from public.james_meta_strategies s
    left join public.james_meta_strategy_evidence e on e.strategy_id=s.id
   where s.id=p_strategy_id
  on conflict(strategy_id) do update set
    integrity_conflict_count=excluded.integrity_conflict_count,
    integrity_conflict_score=excluded.integrity_conflict_score,
    trust_score=excluded.trust_score,
    lineage_completeness=excluded.lineage_completeness,
    evidence=excluded.evidence,
    refreshed_at=now();

  return jsonb_build_object('strategyId',p_strategy_id,'integrityConflicts',v_conflicts,
    'openHighConflicts',v_open_high,'trustScore',v_trust,'lineageCompleteness',v_lineage);
end;
$$;

create or replace function public.refresh_james_meta_strategy_integrity_trust_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.refresh_james_meta_strategy_integrity_trust(coalesce(new.strategy_id,old.strategy_id));
  return coalesce(new,old);
end;
$$;

drop trigger if exists james_meta_strategy_integrity_trust_refresh on public.james_meta_strategy_evidence_conflicts;
create trigger james_meta_strategy_integrity_trust_refresh
after insert or update or delete on public.james_meta_strategy_evidence_conflicts
for each row execute function public.refresh_james_meta_strategy_integrity_trust_trigger();

revoke all on function public.refresh_james_meta_strategy_integrity_trust(uuid)
from public,anon,authenticated;
grant execute on function public.refresh_james_meta_strategy_integrity_trust(uuid) to service_role;
revoke all on function public.refresh_james_meta_strategy_integrity_trust_trigger()
from public,anon,authenticated;
grant execute on function public.refresh_james_meta_strategy_integrity_trust_trigger() to service_role;
