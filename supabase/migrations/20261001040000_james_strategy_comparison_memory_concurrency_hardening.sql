-- James Strategy Comparison Memory Concurrency Hardening v1
-- Serialize identical comparison-memory keys so concurrent trials cannot
-- lose increments or create duplicate global memory rows.

create or replace function public.record_james_strategy_comparison_memory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comparison jsonb;
  v_parent text;
  v_candidate text;
  v_improvement numeric;
  v_improved boolean;
  v_pattern text;
  v_strategy text;
  v_existing record;
  v_success integer;
  v_failure integer;
  v_total integer;
  v_confidence numeric;
begin
  v_comparison := coalesce(new.evidence->'strategyComparison', '{}'::jsonb);
  v_parent := nullif(v_comparison->>'parentStrategyId', '');
  v_candidate := coalesce(nullif(v_comparison->>'candidateStrategyId', ''), new.strategy_id::text);
  v_improvement := nullif(v_comparison->>'improvement', '')::numeric;

  if v_parent is null or v_improvement is null then
    return new;
  end if;

  v_improved := v_improvement > 0;
  v_pattern := 'fun-zone:strategy-comparison:' || v_parent || ':' || v_candidate;
  v_strategy := 'Parent ' || v_parent || ' -> Candidate ' || v_candidate;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'experience|' || coalesce(v_pattern, '') || '|' || coalesce(v_strategy, ''),
      0
    )
  );

  select id, success_count, failure_count, confidence
    into v_existing
    from public.james_experiences
   where pattern = v_pattern
     and strategy = v_strategy
     and user_id is null
   order by updated_at desc, id
   limit 1
   for update;

  v_success := coalesce(v_existing.success_count, 0) + case when v_improved then 1 else 0 end;
  v_failure := coalesce(v_existing.failure_count, 0) + case when v_improved then 0 else 1 end;
  v_total := v_success + v_failure;
  v_confidence := least(0.99, greatest(0.1,
    case when v_total > 0
      then (v_success::numeric / v_total) * 0.7 + coalesce(v_existing.confidence, 0.5) * 0.3
      else 0.5
    end
  ));

  if v_existing.id is not null then
    update public.james_experiences
       set confidence = v_confidence,
           success_count = v_success,
           failure_count = v_failure,
           capabilities = '[\"fun-zone-strategy-comparison\",\"retired-strategy-learning\"]'::jsonb,
           status = 'active',
           last_evidence = jsonb_build_object(
             'parentStrategyId', v_parent,
             'candidateStrategyId', v_candidate,
             'parentQuality', v_comparison->'parentQuality',
             'candidateQuality', v_comparison->'candidateQuality',
             'improvement', v_improvement,
             'improved', v_improved,
             'mutation', 'retired-strategy-synthesis',
             'scenarioKey', new.scenario_key,
             'outcome', case when v_improved then 'success' else 'failure' end,
             'lesson', case when v_improved
               then 'Candidate improved on retired parent; preserve this mutation as synthesis evidence.'
               else 'Candidate underperformed retired parent; preserve the failure and require a materially different branch.'
             end,
             'recordedAt', now()
           ),
           updated_at = now()
     where id = v_existing.id;
  else
    insert into public.james_experiences(
      pattern, strategy, confidence, success_count, failure_count,
      capabilities, status, last_evidence, user_id
    )
    values(
      v_pattern, v_strategy, v_confidence, v_success, v_failure,
      '[\"fun-zone-strategy-comparison\",\"retired-strategy-learning\"]'::jsonb,
      'active',
      jsonb_build_object(
        'parentStrategyId', v_parent,
        'candidateStrategyId', v_candidate,
        'parentQuality', v_comparison->'parentQuality',
        'candidateQuality', v_comparison->'candidateQuality',
        'improvement', v_improvement,
        'improved', v_improved,
        'mutation', 'retired-strategy-synthesis',
        'scenarioKey', new.scenario_key,
        'outcome', case when v_improved then 'success' else 'failure' end,
        'lesson', case when v_improved
          then 'Candidate improved on retired parent; preserve this mutation as synthesis evidence.'
          else 'Candidate underperformed retired parent; preserve the failure and require a materially different branch.'
        end,
        'recordedAt', now()
      ),
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists james_strategy_comparison_memory_trigger
on public.james_meta_strategy_trials;

create trigger james_strategy_comparison_memory_trigger
after insert or update of evidence
on public.james_meta_strategy_trials
for each row
execute function public.record_james_strategy_comparison_memory();

revoke all on function public.record_james_strategy_comparison_memory()
from public, anon, authenticated;
grant execute on function public.record_james_strategy_comparison_memory()
to service_role;
