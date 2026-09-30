create or replace function public.evaluate_james_meta_strategy_regression(
  p_strategy_id uuid,
  p_window integer default 8,
  p_min_samples integer default 4,
  p_failure_threshold numeric default 0.35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_samples integer;
  v_score numeric;
  v_recent_failure_rate numeric;
  v_status text;
  v_action text;
begin
  select count(*),
    coalesce(avg(case when outcome='success' then 1 when outcome='partial' then quality else 0 end),0),
    coalesce(avg(case when outcome='failure' then 1 else 0 end),0)
  into v_samples,v_score,v_recent_failure_rate
  from (
    select outcome,quality
    from public.james_meta_strategy_trials
    where strategy_id=p_strategy_id
    order by created_at desc
    limit greatest(1,least(50,p_window))
  ) x;

  select status into v_status
  from public.james_meta_strategy_synthesis
  where id=p_strategy_id;

  if v_status is null then
    return jsonb_build_object('guarded',false,'reason','strategy_not_found');
  end if;

  if v_samples < greatest(1,p_min_samples) then
    v_action := 'observe';
  elsif v_recent_failure_rate >= p_failure_threshold or v_score < 0.45 then
    update public.james_meta_strategy_synthesis
    set status='candidate', updated_at=now()
    where id=p_strategy_id and status='validated';
    v_action := 'quarantine';
  else
    v_action := 'continue';
  end if;

  return jsonb_build_object(
    'guarded',true,
    'strategyId',p_strategy_id,
    'action',v_action,
    'sampleCount',v_samples,
    'recentScore',v_score,
    'recentFailureRate',v_recent_failure_rate,
    'previousStatus',v_status
  );
end;
$$;

revoke all on function public.evaluate_james_meta_strategy_regression(uuid,integer,integer,numeric)
from public,anon,authenticated;
grant execute on function public.evaluate_james_meta_strategy_regression(uuid,integer,integer,numeric)
to service_role;