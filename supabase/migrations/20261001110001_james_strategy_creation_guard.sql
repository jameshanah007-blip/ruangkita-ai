-- Guard creation of new meta-strategies before persistence.
create or replace function public.guard_james_meta_strategy_creation(
 p_task_class text,
 p_strategy text,
 p_confidence numeric,
 p_source_event_key text
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_decision text;v_reason text;v_key text;
begin
 if coalesce(length(trim(p_task_class)),0)=0 or coalesce(length(trim(p_strategy)),0)=0 then
  v_decision:='blocked';v_reason:='invalid_strategy_payload';
 elsif coalesce(p_confidence,0)<.75 then
  v_decision:='requires_revalidation';v_reason:='model_confidence_below_creation_threshold';
 else
  v_decision:='allowed';v_reason:='verified_meta_learning_payload_passed_creation_gate';
 end if;
 v_key:=coalesce(p_source_event_key,'creation:'||md5(coalesce(p_task_class,'')||':'||coalesce(p_strategy,'')));
 insert into public.james_meta_strategy_mutation_events(source_strategy_id,mutation_type,decision,source_event_key,evidence_snapshot,reason)
 values(null,'create',v_decision,v_key,jsonb_build_object('taskClass',p_task_class,'strategy',p_strategy,'confidence',p_confidence),v_reason)
 on conflict(source_event_key) do nothing;
 return jsonb_build_object('allowed',v_decision='allowed','decision',v_decision,'reason',v_reason,'taskClass',p_task_class,'confidence',p_confidence);
end;$$;
revoke all on function public.guard_james_meta_strategy_creation(text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.guard_james_meta_strategy_creation(text,text,numeric,text) to service_role;