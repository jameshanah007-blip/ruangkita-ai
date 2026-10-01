-- Strategy Mutation Safety v1
create table if not exists public.james_meta_strategy_mutation_events (
 id uuid primary key default gen_random_uuid(),
 source_strategy_id uuid references public.james_meta_strategies(id) on delete set null,
 mutation_type text not null check (mutation_type in ('create','mutate','retire','clone')),
 decision text not null check (decision in ('allowed','blocked','requires_revalidation')),
 source_event_key text not null unique,
 evidence_snapshot jsonb not null default '{}'::jsonb,
 reason text not null,
 created_at timestamptz not null default now()
);
create index if not exists james_meta_strategy_mutation_events_strategy_idx on public.james_meta_strategy_mutation_events(source_strategy_id,created_at desc);
alter table public.james_meta_strategy_mutation_events enable row level security;

create or replace function public.guard_james_meta_strategy_mutation(p_strategy_id uuid,p_mutation_type text,p_source_event_key text,p_min_trust numeric default .60,p_max_conflict_rate numeric default .20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s record;e record;v_decision text;v_reason text;v_key text;
begin
select * into s from public.james_meta_strategies where id=p_strategy_id;
if s.id is null then return jsonb_build_object('allowed',false,'decision','blocked','reason','strategy_not_found','strategyId',p_strategy_id);end if;
select * into e from public.james_meta_strategy_evidence where strategy_id=p_strategy_id;
if e.strategy_id is null then v_decision:='requires_revalidation';v_reason:='evidence_not_available';
elsif s.status='retired' then v_decision:='blocked';v_reason:='retired_strategy_is_immutable';
elsif coalesce(e.conflict_count,0)>0 and coalesce(e.resolved_conflict_count,0)<coalesce(e.conflict_count,0) then v_decision:='blocked';v_reason:='open_evidence_conflict';
elsif coalesce(e.trust_score,0)<greatest(0,least(1,coalesce(p_min_trust,.60))) then v_decision:='requires_revalidation';v_reason:='insufficient_evidence_trust';
elsif coalesce(e.conflict_rate,0)>greatest(0,least(1,coalesce(p_max_conflict_rate,.20))) then v_decision:='requires_revalidation';v_reason:='conflict_rate_above_mutation_threshold';
else v_decision:='allowed';v_reason:='evidence_trust_and_conflict_gates_passed';end if;
v_key:=coalesce(p_source_event_key,'mutation:'||p_strategy_id::text||':'||p_mutation_type);
insert into public.james_meta_strategy_mutation_events(source_strategy_id,mutation_type,decision,source_event_key,evidence_snapshot,reason)
values(p_strategy_id,p_mutation_type,v_decision,v_key,coalesce(to_jsonb(e),'{}'::jsonb),v_reason)
on conflict(source_event_key) do nothing;
return jsonb_build_object('allowed',v_decision='allowed','decision',v_decision,'reason',v_reason,'strategyId',p_strategy_id,'mutationType',p_mutation_type,'trustScore',coalesce(e.trust_score,0),'conflictRate',coalesce(e.conflict_rate,0),'openConflictCount',greatest(0,coalesce(e.conflict_count,0)-coalesce(e.resolved_conflict_count,0));
end;$$;
revoke all on function public.guard_james_meta_strategy_mutation(uuid,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.guard_james_meta_strategy_mutation(uuid,text,text,numeric,numeric) to service_role;