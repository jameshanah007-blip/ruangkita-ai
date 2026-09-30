create or replace function public.enqueue_stale_james_knowledge_revalidation(
  p_limit integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id, 'consolidation'::text as source
    from public.james_experience_consolidations
    where coalesce(last_validated_at, created_at)
      < now() - make_interval(days => greatest(1, stale_after_days))
    order by coalesce(last_validated_at, created_at) asc
    limit greatest(1, p_limit)
  loop
    insert into public.james_learning_queue
      (topic, priority, task_type, reason, status, attempts)
    select
      'revalidate:' || r.source || ':' || r.id::text,
      0.92,
      'verification',
      'Knowledge has exceeded its validation age and requires revalidation.',
      'pending',
      0
    where not exists (
      select 1 from public.james_learning_queue q
      where q.topic = 'revalidate:' || r.source || ':' || r.id::text
        and q.status in ('pending','running')
    );
    if found then v_count := v_count + 1; end if;
  end loop;

  for r in
    select id, 'experience'::text as source
    from public.james_experiences
    where coalesce(last_validated_at, created_at)
      < now() - make_interval(days => greatest(1, stale_after_days))
    order by coalesce(last_validated_at, created_at) asc
    limit greatest(1, p_limit)
  loop
    insert into public.james_learning_queue
      (topic, priority, task_type, reason, status, attempts)
    select
      'revalidate:' || r.source || ':' || r.id::text,
      0.92,
      'verification',
      'Knowledge has exceeded its validation age and requires revalidation.',
      'pending',
      0
    where not exists (
      select 1 from public.james_learning_queue q
      where q.topic = 'revalidate:' || r.source || ':' || r.id::text
        and q.status in ('pending','running')
    );
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.enqueue_stale_james_knowledge_revalidation(integer)
from public, anon, authenticated;
grant execute on function public.enqueue_stale_james_knowledge_revalidation(integer)
to service_role;
