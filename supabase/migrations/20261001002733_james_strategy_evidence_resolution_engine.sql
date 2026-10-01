-- Evidence Resolution Engine v1
alter table public.james_meta_strategy_evidence_conflicts
 add column if not exists resolution_method text,
 add column if not exists resolution_reason text,
 add column if not exists resolution_evidence jsonb not null default '{}'::jsonb,
 add column if not exists resolved_by text,
 add column if not exists resolution_event_key text unique;

create index if not exists james_meta_strategy_conflicts_resolution_idx
 on public.james_meta_strategy_evidence_conflicts(strategy_id,resolution_state,resolved_at desc);

create or replace function public.resolve_james_meta_strategy_evidence_conflict(p_conflict_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c record;p record;t record;v_method text:='no_action';v_reason text:='conflict remains unresolved';v_state text:='open';v_key text;
begin
select * into c from public.james_meta_strategy_evidence_conflicts where id=p_conflict_id for update;
if c.id is null then return jsonb_build_object('resolved',false,'reason','conflict_not_found','conflictId',p_conflict_id);end if;
if c.resolution_state<>'open' then return jsonb_build_object('resolved',c.resolution_state='resolved','reason','conflict_already_finalized','conflictId',c.id,'state',c.resolution_state);end if;
select * into p from public.james_meta_strategy_evidence_provenance where id=c.provenance_id;
select * into t from public.james_meta_strategy_trials where id=c.trial_id;
if c.conflict_type='outcome_verification_mismatch' and p.id is not null and t.id is not null then
 if (p.provenance->>'passed')='true' and t.outcome='success' then v_method:='verification_confirms_trial';v_reason:='verification lineage and trial outcome agree after conflict inspection';v_state:='resolved';
 elsif (p.provenance->>'passed')='false' and t.outcome='failure' then v_method:='verification_confirms_trial';v_reason:='verification lineage and trial outcome agree after conflict inspection';v_state:='resolved';
 else v_method:='retain_conflict';v_reason:='verification and trial outcome remain contradictory; no automatic winner is assigned';end if;
else v_method:='retain_conflict';v_reason:='conflict type is not safely auto-resolvable';end if;
if v_state='resolved' then
 v_key:='resolution:'||c.id::text||':'||md5(v_method||':'||v_reason);
 update public.james_meta_strategy_evidence_conflicts set resolution_state='resolved',resolution_method=v_method,resolution_reason=v_reason,resolution_evidence=jsonb_build_object('conflictId',c.id,'strategyId',c.strategy_id,'trialId',c.trial_id,'provenanceId',c.provenance_id,'method',v_method,'reason',v_reason,'resolvedAt',now()),resolved_by='evidence-resolution-engine',resolution_event_key=v_key,resolved_at=now() where id=c.id;
else
 update public.james_meta_strategy_evidence_conflicts set resolution_method=v_method,resolution_reason=v_reason,resolution_evidence=jsonb_build_object('conflictId',c.id,'strategyId',c.strategy_id,'trialId',c.trial_id,'provenanceId',c.provenance_id,'method',v_method,'reason',v_reason,'inspectedAt',now()),resolved_by='evidence-resolution-engine' where id=c.id;
end if;
perform public.refresh_james_meta_strategy_evidence_conflicts(c.strategy_id);
return jsonb_build_object('resolved',v_state='resolved','conflictId',c.id,'strategyId',c.strategy_id,'state',v_state,'method',v_method,'reason',v_reason);
end;$$;

create or replace function public.resolve_all_james_meta_strategy_evidence_conflicts(p_strategy_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c record;v_total integer:=0;v_resolved integer:=0;v_result jsonb;
begin
for c in select id from public.james_meta_strategy_evidence_conflicts where strategy_id=p_strategy_id and resolution_state='open' order by created_at asc loop
 v_total:=v_total+1;v_result:=public.resolve_james_meta_strategy_evidence_conflict(c.id);
 if (v_result->>'resolved')='true' then v_resolved:=v_resolved+1;end if;
end loop;
perform public.refresh_james_meta_strategy_evidence_conflicts(p_strategy_id);
return jsonb_build_object('strategyId',p_strategy_id,'inspected',v_total,'resolved',v_resolved,'remainingOpen',v_total-v_resolved);
end;$$;

revoke all on function public.resolve_james_meta_strategy_evidence_conflict(uuid) from public,anon,authenticated;
revoke all on function public.resolve_all_james_meta_strategy_evidence_conflicts(uuid) from public,anon,authenticated;
grant execute on function public.resolve_james_meta_strategy_evidence_conflict(uuid) to service_role;
grant execute on function public.resolve_all_james_meta_strategy_evidence_conflicts(uuid) to service_role;