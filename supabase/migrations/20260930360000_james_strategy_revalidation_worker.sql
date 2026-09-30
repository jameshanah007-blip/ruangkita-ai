create or replace function public.claim_james_meta_strategy_revalidation_job(
  p_worker_id text
)
returns table(
  id uuid,
  strategy_id uuid,
  reason text,
  priority numeric,
  worker_id text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select q.id
    from public.james_meta_strategy_revalidation_queue q
    where q.status='pending'
      and q.scheduled_at <= now()
    order by q.priority desc,q.scheduled_at asc
    limit 1
    for update skip locked
  )
  update public.james_meta_strategy_revalidation_queue q
  set status='running',claimed_at=now(),evidence=jsonb_set(coalesce(q.evidence,'{}'::jsonb),'{workerId}',to_jsonb(p_worker_id))
  from candidate c
  where q.id=c.id
  returning q.id,q.strategy_id,q.reason,q.priority,p_worker_id;
end;
$$;

create or replace function public.complete_james_meta_strategy_revalidation_job(
  p_job_id uuid,
  p_outcome text,
  p_quality numeric default 0.5,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
begin
  select * into q from public.james_meta_strategy_revalidation_queue where id=p_job_id for update;
  if q.id is null then return jsonb_build_object('completed',false,'reason','job_not_found'); end if;

  update public.james_meta_strategy_revalidation_queue
  set status='completed',completed_at=now(),
      evidence=coalesce(p_evidence,'{}'::jsonb)||jsonb_build_object('outcome',p_outcome,'quality',p_quality)
  where id=p_job_id;

  insert into public.james_meta_strategy_trials(strategy_id,scenario_key,outcome,quality,evidence)
  values(q.strategy_id,'autonomous-revalidation:'||q.id,p_outcome,greatest(0,least(1,p_quality)),coalesce(p_evidence,'{}'::jsonb));

  return jsonb_build_object('completed',true,'strategyId',q.strategy_id,'outcome',p_outcome);
end;
$$;

revoke all on function public.claim_james_meta_strategy_revalidation_job(text) from public,anon,authenticated;
revoke all on function public.complete_james_meta_strategy_revalidation_job(uuid,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.claim_james_meta_strategy_revalidation_job(text) to service_role;
grant execute on function public.complete_james_meta_strategy_revalidation_job(uuid,text,numeric,jsonb) to service_role;