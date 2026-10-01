-- James Strategy Revalidation Wake-up v1
-- Blocked jobs become eligible again when durable evidence improves.
create or replace function public.requeue_james_meta_strategy_revalidation(
  p_strategy_id uuid
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  e record;
  v_count integer := 0;
begin
  select * into e
  from public.james_meta_strategy_evidence
  where strategy_id=p_strategy_id;

  if e.strategy_id is null then
    return 0;
  end if;

  if coalesce(e.evidence_count,0) < 2
     or coalesce(e.trust_score,0) < .60
     or greatest(0,coalesce(e.conflict_count,0)-coalesce(e.resolved_conflict_count,0)) > 0 then
    return 0;
  end if;

  update public.james_meta_strategy_revalidation_queue q
  set state='pending',
      updated_at=now(),
      completed_at=null,
      result_snapshot=jsonb_build_object(
        'reason','evidence_recovered_revalidation_requeued',
        'evidenceCount',e.evidence_count,
        'trustScore',e.trust_score,
        'openConflictCount',greatest(0,coalesce(e.conflict_count,0)-coalesce(e.resolved_conflict_count,0)),
        'requeuedAt',now()
      )
  where q.strategy_id=p_strategy_id
    and q.state='blocked'
    and q.attempts < q.max_attempts;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.requeue_james_meta_strategy_revalidation(uuid)
from public,anon,authenticated;
grant execute on function public.requeue_james_meta_strategy_revalidation(uuid)
to service_role;

create or replace function public.requeue_james_meta_strategy_revalidation_after_evidence()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.requeue_james_meta_strategy_revalidation(new.strategy_id);
  return new;
end;
$$;

drop trigger if exists james_meta_strategy_revalidation_wakeup
on public.james_meta_strategy_evidence;

create trigger james_meta_strategy_revalidation_wakeup
after insert or update of
  evidence_count,
  trust_score,
  conflict_count,
  resolved_conflict_count,
  conflict_rate,
  provenance_coverage,
  verification_coverage,
  lineage_completeness
on public.james_meta_strategy_evidence
for each row
execute function public.requeue_james_meta_strategy_revalidation_after_evidence();

revoke all on function public.requeue_james_meta_strategy_revalidation_after_evidence()
from public,anon,authenticated;
grant execute on function public.requeue_james_meta_strategy_revalidation_after_evidence()
to service_role;
