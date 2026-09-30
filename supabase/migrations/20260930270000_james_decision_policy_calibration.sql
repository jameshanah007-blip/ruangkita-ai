create table if not exists public.james_decision_policy_calibration (
  policy_key text primary key,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  partial_count integer not null default 0,
  unknown_count integer not null default 0,
  avg_quality numeric(5,4) not null default 0.5,
  calibration_score numeric(5,4) not null default 0.5,
  adjustment numeric(5,4) not null default 0,
  sample_count integer not null default 0,
  last_calibrated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.james_decision_policy_calibration enable row level security;

create or replace function public.calibrate_james_decision_policy(
  p_policy_key text,
  p_window_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_success numeric;
  v_failure numeric;
  v_partial numeric;
  v_unknown numeric;
  v_total numeric;
  v_quality numeric;
  v_score numeric;
  v_adjustment numeric;
begin
  select
    count(*) filter (where o.outcome='success'),
    count(*) filter (where o.outcome='failure'),
    count(*) filter (where o.outcome='partial'),
    count(*) filter (where o.outcome='unknown'),
    coalesce(avg(o.quality),0.5)
  into v_success,v_failure,v_partial,v_unknown,v_quality
  from public.james_knowledge_decision_outcomes o
  join public.james_knowledge_decision_traces t on t.id=o.decision_trace_id
  where t.decision = p_policy_key
    and o.created_at >= now() - make_interval(days => greatest(1,p_window_days));

  v_total := v_success+v_failure+v_partial+v_unknown;

  if v_total=0 then
    return jsonb_build_object('calibrated',false,'reason','no_outcomes');
  end if;

  v_score := (
    (v_success/v_total)*0.55 +
    (v_partial/v_total)*0.20 +
    v_quality*0.25
  );

  v_adjustment := greatest(-0.10,least(0.10,(v_score-0.5)*0.20));

  insert into public.james_decision_policy_calibration(
    policy_key,success_count,failure_count,partial_count,unknown_count,
    avg_quality,calibration_score,adjustment,sample_count,last_calibrated_at
  )
  values(
    p_policy_key,v_success::integer,v_failure::integer,v_partial::integer,v_unknown::integer,
    v_quality,v_score,v_adjustment,v_total::integer,now()
  )
  on conflict(policy_key) do update set
    success_count=excluded.success_count,
    failure_count=excluded.failure_count,
    partial_count=excluded.partial_count,
    unknown_count=excluded.unknown_count,
    avg_quality=excluded.avg_quality,
    calibration_score=excluded.calibration_score,
    adjustment=excluded.adjustment,
    sample_count=excluded.sample_count,
    last_calibrated_at=excluded.last_calibrated_at;

  return jsonb_build_object(
    'calibrated',true,
    'policyKey',p_policy_key,
    'sampleCount',v_total,
    'calibrationScore',v_score,
    'adjustment',v_adjustment
  );
end;
$$;

revoke all on function public.calibrate_james_decision_policy(text,integer)
from public,anon,authenticated;
grant execute on function public.calibrate_james_decision_policy(text,integer)
to service_role;
