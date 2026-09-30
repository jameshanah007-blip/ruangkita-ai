create or replace function public.apply_james_knowledge_revalidation(
  p_knowledge_id uuid, p_knowledge_source text, p_outcome text,
  p_quality numeric default 0.5, p_evidence jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old numeric; v_new numeric; v_quality numeric := greatest(0, least(1, coalesce(p_quality,0.5)));
begin
  if p_outcome not in ('success','failure','partial') then raise exception 'invalid revalidation outcome'; end if;
  if p_knowledge_source='consolidation' then
    select confidence into v_old from public.james_experience_consolidations where id=p_knowledge_id;
  elsif p_knowledge_source='experience' then
    select confidence into v_old from public.james_experiences where id=p_knowledge_id;
  else raise exception 'unsupported knowledge source'; end if;
  if v_old is null then return jsonb_build_object('updated',false,'reason','knowledge_not_found'); end if;
  v_new := case
    when p_outcome='success' then greatest(0,least(1,v_old+least(0.08,0.08*v_quality)))
    when p_outcome='failure' then greatest(0,least(1,v_old-least(0.08,0.08*greatest(0.25,1-v_quality))))
    else greatest(0,least(1,v_old+0.03*(v_quality-0.5))) end;
  if p_knowledge_source='consolidation' then
    update public.james_experience_consolidations set confidence=v_new,last_validated_at=now(),updated_at=now() where id=p_knowledge_id;
  else
    update public.james_experiences set confidence=v_new,last_validated_at=now(),updated_at=now() where id=p_knowledge_id;
  end if;
  insert into public.james_knowledge_feedback(knowledge_id,knowledge_source,task,outcome,quality,evidence)
  values(p_knowledge_id,p_knowledge_source,'stale-knowledge-revalidation',p_outcome,v_quality,p_evidence);
  return jsonb_build_object('updated',true,'previousConfidence',v_old,'newConfidence',v_new,'validatedAt',now(),'outcome',p_outcome);
end; $$;
revoke all on function public.apply_james_knowledge_revalidation(uuid,text,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.apply_james_knowledge_revalidation(uuid,text,text,numeric,jsonb) to service_role;