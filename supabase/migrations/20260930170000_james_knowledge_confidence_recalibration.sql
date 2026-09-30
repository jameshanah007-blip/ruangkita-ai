create or replace function public.recalibrate_james_knowledge_confidence(
  p_knowledge_id uuid,
  p_knowledge_source text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old numeric;
  v_new numeric;
  v_success numeric;
  v_total numeric;
  v_quality numeric;
  v_confidence numeric;
begin
  if p_knowledge_source = 'consolidation' then
    select confidence into v_old
    from public.james_experience_consolidations
    where id = p_knowledge_id;
  elsif p_knowledge_source = 'experience' then
    select confidence into v_old
    from public.james_experiences
    where id = p_knowledge_id;
  else
    raise exception 'unsupported knowledge source';
  end if;

  if v_old is null then
    return null;
  end if;

  select
    count(*) filter (where outcome = 'success')::numeric,
    count(*)::numeric,
    coalesce(avg(quality), 0.5)
  into v_success, v_total, v_quality
  from public.james_knowledge_feedback
  where knowledge_id = p_knowledge_id
    and knowledge_source = p_knowledge_source;

  if v_total = 0 then
    return v_old;
  end if;

  v_confidence := (
    (v_success / v_total) * 0.55 +
    v_quality * 0.35 +
    least(1, v_total / 10.0) * 0.10
  );

  -- Bounded recalibration: never move more than 0.10 per cycle.
  v_new := greatest(0, least(1, v_old + greatest(-0.10, least(0.10, v_confidence - v_old))));

  if p_knowledge_source = 'consolidation' then
    update public.james_experience_consolidations
    set confidence = v_new, updated_at = now()
    where id = p_knowledge_id;
  else
    update public.james_experiences
    set confidence = v_new, updated_at = now()
    where id = p_knowledge_id;
  end if;

  return v_new;
end;
$$;

revoke all on function public.recalibrate_james_knowledge_confidence(uuid,text) from public, anon, authenticated;
grant execute on function public.recalibrate_james_knowledge_confidence(uuid,text) to service_role;
