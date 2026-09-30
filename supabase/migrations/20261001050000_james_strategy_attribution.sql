create or replace function public.attribute_james_experiment_strategy()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_strategy record;
begin
  if new.learning_result is null or jsonb_typeof(new.learning_result) <> 'object' then
    new.learning_result := '{}'::jsonb;
  end if;

  select id, strategy, task_class, confidence, evidence_count
    into v_strategy
    from public.james_meta_strategies
   where status = 'active'
     and (
       capabilities @> jsonb_build_array(coalesce(new.capability_key, ''))
       or capabilities @> jsonb_build_array(coalesce(new.capability_name, ''))
       or task_class = lower(coalesce(new.capability_key, ''))
       or task_class = lower(coalesce(new.capability_name, ''))
       or task_class = 'fun_zone'
     )
   order by confidence desc, evidence_count desc, updated_at desc
   limit 1;

  if v_strategy.id is null then
    new.learning_result := new.learning_result || jsonb_build_object(
      'strategyId', null,
      'strategyAttribution', 'no-active-strategy'
    );
    return new;
  end if;

  new.learning_result := new.learning_result || jsonb_build_object(
    'strategyId', v_strategy.id,
    'strategy', v_strategy.strategy,
    'strategyTaskClass', v_strategy.task_class,
    'strategyConfidence', v_strategy.confidence,
    'strategyEvidenceCount', v_strategy.evidence_count,
    'strategyAttribution', 'selected-before-execution'
  );

  return new;
end;
$$;

drop trigger if exists james_experiment_strategy_attribution
on public.james_game_experiments;

create trigger james_experiment_strategy_attribution
before insert on public.james_game_experiments
for each row
execute function public.attribute_james_experiment_strategy();

revoke all on function public.attribute_james_experiment_strategy()
from public, anon, authenticated;