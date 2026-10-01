-- Evidence Conflict Resolution v1
alter table public.james_meta_strategy_evidence
  add column if not exists conflict_count integer not null default 0,
  add column if not exists resolved_conflict_count integer not null default 0,
  add column if not exists conflict_rate numeric not null default 0,
  add column if not exists conflict_score numeric not null default 0;

create table if not exists public.james_meta_strategy_evidence_conflicts (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.james_meta_strategies(id) on delete cascade,
  trial_id uuid references public.james_meta_strategy_trials(id) on delete set null,
  provenance_id uuid references public.james_meta_strategy_evidence_provenance(id) on delete set null,
  conflict_type text not null check (conflict_type in ('outcome_verification_mismatch','verification_lineage_mismatch','duplicate_lineage_conflict')),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  resolution_state text not null default 'open' check (resolution_state in ('open','resolved','superseded')),
  source_event_key text not null unique,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists james_meta_strategy_evidence_conflicts_strategy_idx on public.james_meta_strategy_evidence_conflicts(strategy_id,resolution_state,created_at desc);
alter table public.james_meta_strategy_evidence_conflicts enable row level security;

create or replace function public.refresh_james_meta_strategy_evidence_conflicts(p_strategy_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_conflicts integer:=0; v_resolved integer:=0; v_trials integer:=0; v_rate numeric:=0; v_score numeric:=0;
begin
select count(*)::int,count(*) filter(where resolution_state='resolved')::int into v_conflicts,v_resolved from public.james_meta_strategy_evidence_conflicts where strategy_id=p_strategy_id;
select count(*)::int into v_trials from public.james_meta_strategy_trials where strategy_id=p_strategy_id;
v_rate:=case when v_trials>0 then least(1,v_conflicts::numeric/v_trials) else 0 end;
v_score:=case when v_conflicts>0 then greatest(0,1-(v_resolved::numeric/v_conflicts)) else 0 end;
update public.james_meta_strategy_evidence set conflict_count=v_conflicts,resolved_conflict_count=v_resolved,conflict_rate=v_rate,conflict_score=v_score,
 evidence=jsonb_set(jsonb_set(jsonb_set(jsonb_set(coalesce(evidence,'{}'::jsonb),'{conflictCount}',to_jsonb(v_conflicts),true),'{resolvedConflictCount}',to_jsonb(v_resolved),true),'{conflictRate}',to_jsonb(v_rate),true),'{conflictScore}',to_jsonb(v_score),true),refreshed_at=now()
where strategy_id=p_strategy_id;
return jsonb_build_object('strategyId',p_strategy_id,'conflictCount',v_conflicts,'resolvedConflictCount',v_resolved,'conflictRate',v_rate,'conflictScore',v_score);
end; $$;

create or replace function public.detect_james_meta_strategy_evidence_conflicts(p_strategy_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; v_detected integer:=0; v_expected text; v_actual text; v_key text;
begin
for r in select ep.id provenance_id,ep.trial_id,ep.strategy_id,ep.provenance,t.outcome,t.quality
from public.james_meta_strategy_evidence_provenance ep join public.james_meta_strategy_trials t on t.id=ep.trial_id
where ep.strategy_id=p_strategy_id and ep.source_type='verification' and ep.trial_id is not null loop
v_expected:=case when r.outcome='success' then 'true' when r.outcome='failure' then 'false' else null end;
v_actual:=case when r.provenance->>'passed' is not null then lower(r.provenance->>'passed') else null end;
if v_expected is not null and v_actual is not null and v_expected<>v_actual then
v_key:='outcome-verification:'||r.provenance_id::text;
insert into public.james_meta_strategy_evidence_conflicts(strategy_id,trial_id,provenance_id,conflict_type,severity,resolution_state,source_event_key,evidence)
values(r.strategy_id,r.trial_id,r.provenance_id,'outcome_verification_mismatch','high','open',v_key,jsonb_build_object('trialOutcome',r.outcome,'verificationPassed',r.provenance->>'passed','quality',r.quality,'provenanceId',r.provenance_id,'trialId',r.trial_id))
on conflict(source_event_key) do nothing;
v_detected:=v_detected+1;
end if;
end loop;
perform public.refresh_james_meta_strategy_evidence_conflicts(p_strategy_id);
return jsonb_build_object('strategyId',p_strategy_id,'detected',v_detected);
end; $$;

create or replace function public.reconcile_james_meta_strategy_lifecycle(p_strategy_id uuid,p_min_samples integer default 4,p_promote_score numeric default .75,p_retire_score numeric default .35)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s record;e record;v_open integer:=0;v_high integer:=0;v_min integer:=greatest(1,coalesce(p_min_samples,4));v_promote numeric:=greatest(0,least(1,coalesce(p_promote_score,.75)));v_retire numeric:=greatest(0,least(v_promote,coalesce(p_retire_score,.35)));v_score numeric:=0;v_next text;v_reason text;v_fp text;v_event uuid;v_changed boolean:=false;
begin
select id,task_class,status,evidence_count,success_count,failure_count,confidence into s from public.james_meta_strategies where id=p_strategy_id for update;
if s.id is null then return jsonb_build_object('reconciled',false,'reason','strategy_not_found','strategyId',p_strategy_id);end if;
select * into e from public.james_meta_strategy_evidence where strategy_id=p_strategy_id;
if e.strategy_id is null then return jsonb_build_object('reconciled',false,'reason','evidence_not_available','strategyId',p_strategy_id,'status',s.status);end if;
select count(*)::int,count(*) filter(where severity='high')::int into v_open,v_high from public.james_meta_strategy_evidence_conflicts where strategy_id=p_strategy_id and resolution_state='open';
v_score:=greatest(0,least(1,coalesce(e.outcome_rate,0)*.55+coalesce(e.avg_quality,0)*.20+coalesce(e.confidence,0)*.25));
v_next:=s.status;v_reason:='evidence does not cross a lifecycle threshold';
if v_high>0 then v_reason:='open high-severity evidence conflict blocks lifecycle transition';
elsif v_open>0 then v_reason:='open evidence conflict blocks lifecycle transition';
elsif e.evidence_count<v_min then v_reason:='minimum evidence threshold not reached';
elsif s.status='candidate' and v_score>=v_promote then v_next:='active';v_reason:='candidate met empirical promotion threshold';
elsif s.status='active' and v_score<=v_retire then v_next:='retired';v_reason:='active strategy fell below empirical retirement threshold';
elsif s.status='retired' then v_next:='retired';v_reason:='retired strategies remain historical evidence';end if;
v_fp:=md5(jsonb_build_object('strategyId',e.strategy_id,'evidenceCount',e.evidence_count,'trialCount',e.trial_count,'successCount',e.success_count,'failureCount',e.failure_count,'confidence',e.confidence,'score',v_score,'openConflicts',v_open,'highConflicts',v_high)::text);
insert into public.james_meta_strategy_lifecycle_events(strategy_id,previous_status,next_status,evidence_fingerprint,evidence_snapshot,reason)
values(s.id,s.status,v_next,v_fp,jsonb_build_object('evidenceCount',e.evidence_count,'trialCount',e.trial_count,'outcomeRate',e.outcome_rate,'avgQuality',e.avg_quality,'confidence',e.confidence,'score',v_score,'openConflictCount',v_open,'highConflictCount',v_high,'minimumSamples',v_min,'promoteScore',v_promote,'retireScore',v_retire),v_reason)
on conflict(strategy_id,evidence_fingerprint) do nothing returning id into v_event;
if v_next<>s.status and v_open=0 then update public.james_meta_strategies set status=v_next,updated_at=now() where id=s.id;v_changed:=true;end if;
return jsonb_build_object('reconciled',true,'changed',v_changed,'strategyId',s.id,'previousStatus',s.status,'status',v_next,'score',v_score,'evidenceCount',e.evidence_count,'confidence',e.confidence,'openConflictCount',v_open,'highConflictCount',v_high,'reason',v_reason,'eventId',v_event,'idempotent',v_event is null);
end; $$;

revoke all on function public.refresh_james_meta_strategy_evidence_conflicts(uuid) from public,anon,authenticated;
revoke all on function public.detect_james_meta_strategy_evidence_conflicts(uuid) from public,anon,authenticated;
revoke all on function public.reconcile_james_meta_strategy_lifecycle(uuid,integer,numeric,numeric) from public,anon,authenticated;
grant execute on function public.refresh_james_meta_strategy_evidence_conflicts(uuid) to service_role;
grant execute on function public.detect_james_meta_strategy_evidence_conflicts(uuid) to service_role;
grant execute on function public.reconcile_james_meta_strategy_lifecycle(uuid,integer,numeric,numeric) to service_role;
