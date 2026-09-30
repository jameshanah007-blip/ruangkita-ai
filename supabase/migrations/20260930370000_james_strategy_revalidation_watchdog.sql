create or replace function public.recover_stale_james_strategy_revalidation_jobs(
  p_stale_minutes integer default 20,
  p_limit integer default 20
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer:=0;
begin
  update public.james_meta_strategy_revalidation_queue
  set status='pending',
      claimed_at=null,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'watchdogRecoveredAt',now(),
        'recoveryReason','stale_running_job'
      )
  where id in (
    select id
    from public.james_meta_strategy_revalidation_queue
    where status='running'
      and claimed_at < now()-make_interval(mins=>greatest(1,p_stale_minutes))
    order by claimed_at asc
    limit greatest(1,least(100,p_limit))
    for update skip locked
  );

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.recover_stale_james_strategy_revalidation_jobs(integer,integer)
from public,anon,authenticated;
grant execute on function public.recover_stale_james_strategy_revalidation_jobs(integer,integer)
to service_role;