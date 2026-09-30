create or replace function public.promote_retire_james_meta_strategy(
  p_strategy_id uuid,
  p_min_samples integer default 4,
  p_promote_score numeric default 0.75,
  p_retire_score numeric default 0.35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strategy record;
  v_samples integer;
  v_score numeric;
  v_success numeric;
  v_quality numeric;
  v_new_status text;
begin
  select * into v_strategy
  from public.james_meta_strategy_synthesis
  where id=p_strategy_id
  for update;

  if v_strategy.id is null then
    return jsonb_build_object('updated',false,'reason','strategy_not_found');
  end if;

  -- Deprecated is terminal retirement. New evidence must not resurrect
  -- a retired strategy; a genuinely new strategy should be synthesized
  -- with a new strategy identity instead.
  if v_strategy.status = 'deprecated' then
    return jsonb_build_object(
      'updated',false,
      'strategyId',p_strategy_id,
      'status','deprecated',
      'reason','strategy_terminally_retired'
    );
  end if;

  select count(*),
    coalesce(avg(case when outcome='success' then 1 when outcome='partial' then quality else 0 end),0),
    coalesce(avg(quality),0.5)
  into v_samples,v_success,v_quality
  from public.james_meta_strategy_trials
  where strategy_id=p_strategy_id;

  v_score := v_success*0.70 + v_quality*0.30;

  if v_samples >= greatest(1,p_min_samples) and v_score >= p_promote_score then
    v_new_status := 'validated';
  elsif v_samples >= greatest(1,p_min_samples) and v_score <= p_retire_score then
    v_new_status := 'deprecated';
  else
    v_new_status := v_strategy.status;
  end if;

  update public.james_meta_strategy_synthesis
  set status=v_new_status,
      confidence=greatest(0,least(0.99,v_score)),
      updated_at=now()
  where id=p_strategy_id;

  return jsonb_build_object(
    'updated',v_new_status<>v_strategy.status,
    'strategyId',p_strategy_id,
    'status',v_new_status,
    'sampleCount',v_samples,
    'score',v_score,
    'successSignal',v_success,
    'quality',v_quality
  );
end;
$$;

revoke all on function public.promote_retire_james_meta_strategy(uuid,integer,numeric,numeric)
from public,anon,authenticated;
grant execute on function public.promote_retire_james_meta_strategy(uuid,integer,numeric,numeric)
to service_role;