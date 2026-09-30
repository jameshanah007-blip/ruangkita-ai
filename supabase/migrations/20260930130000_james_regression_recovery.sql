create or replace function public.enqueue_james_regression_recovery(
  p_capability text,
  p_reason text,
  p_evidence jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_capability is null or length(trim(p_capability)) = 0 then
    raise exception 'capability is required';
  end if;

  select id into v_id
  from public.james_learning_queue
  where status in ('pending','running')
    and lower(topic) = lower(left(trim(p_capability), 500))
    and task_type in ('verification','learning')
  order by created_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.james_learning_queue(
    topic, priority, task_type, reason, evidence
  )
  values (
    left(trim(p_capability), 500),
    0.98,
    'verification',
    left(coalesce(p_reason, 'Capability regression detected; retest and recover mastery.'), 700),
    p_evidence
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.enqueue_james_regression_recovery(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_james_regression_recovery(text,text,jsonb) to service_role;
