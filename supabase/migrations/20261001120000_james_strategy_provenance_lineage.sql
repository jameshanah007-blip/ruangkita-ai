-- End-to-end strategy provenance lineage.
create table if not exists public.james_meta_strategy_lineage (
 id uuid primary key default gen_random_uuid(),
 strategy_id uuid not null unique references public.james_meta_strategies(id) on delete cascade,
 creation_event_count integer not null default 0, mutation_event_count integer not null default 0,
 trial_count integer not null default 0, usage_count integer not null default 0, verified_usage_count integer not null default 0,
 provenance_count integer not null default 0, conflict_count integer not null default 0, open_conflict_count integer not null default 0,
 lifecycle_event_count integer not null default 0, lineage_coverage numeric not null default 0,
 lineage_state text not null default 'incomplete' check(lineage_state in ('complete','partial','incomplete')),
 lineage_snapshot jsonb not null default '{}', refreshed_at timestamptz not null default now()
);
alter table public.james_meta_strategy_lineage enable row level security;
create index if not exists james_meta_strategy_lineage_state_idx on public.james_meta_strategy_lineage(lineage_state,refreshed_at desc);
create or replace function public.refresh_james_meta_strategy_lineage(p_strategy_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_creation integer:=0;v_mutation integer:=0;v_trials integer:=0;v_usage integer:=0;v_verified integer:=0;v_prov integer:=0;v_conflicts integer:=0;v_open integer:=0;v_lifecycle integer:=0;v_coverage numeric:=0;v_state text:='incomplete';
begin
select count(*) filter(where mutation_type='create')::int,count(*) filter(where mutation_type<>'create')::int into v_creation,v_mutation from public.james_meta_strategy_mutation_events where source_strategy_id=p_strategy_id;
select count(*)::int into v_trials from public.james_meta_strategy_trials where strategy_id=p_strategy_id;
select count(*)::int,count(*) filter(where usage_state='verified')::int into v_usage,v_verified from public.james_meta_strategy_usage where strategy_id=p_strategy_id;
select count(*)::int into v_prov from public.james_meta_strategy_evidence_provenance where strategy_id=p_strategy_id;
select count(*)::int,count(*) filter(where resolution_state='open')::int into v_conflicts,v_open from public.james_meta_strategy_evidence_conflicts where strategy_id=p_strategy_id;
select count(*)::int into v_lifecycle from public.james_meta_strategy_lifecycle_events where strategy_id=p_strategy_id;
v_coverage:=((case when v_creation>0 then 1 else 0 end)+(case when v_trials>0 then 1 else 0 end)+(case when v_usage>0 then 1 else 0 end)+(case when v_prov>0 then 1 else 0 end)+(case when v_conflicts=0 or v_open=0 then 1 else 0 end)+(case when v_lifecycle>0 then 1 else 0 end))/6.0;
if v_coverage>=1 then v_state:='complete';elsif v_coverage>=.5 then v_state:='partial';end if;
insert into public.james_meta_strategy_lineage(strategy_id,creation_event_count,mutation_event_count,trial_count,usage_count,verified_usage_count,provenance_count,conflict_count,open_conflict_count,lifecycle_event_count,lineage_coverage,lineage_state,lineage_snapshot,refreshed_at)
values(p_strategy_id,v_creation,v_mutation,v_trials,v_usage,v_verified,v_prov,v_conflicts,v_open,v_lifecycle,v_coverage,v_state,jsonb_build_object('strategyId',p_strategy_id,'creationEvents',v_creation,'mutationEvents',v_mutation,'trials',v_trials,'usage',v_usage,'verifiedUsage',v_verified,'provenance',v_prov,'conflicts',v_conflicts,'openConflicts',v_open,'lifecycleEvents',v_lifecycle,'coverage',v_coverage,'state',v_state,'refreshedAt',now()),now())
on conflict(strategy_id) do update set creation_event_count=excluded.creation_event_count,mutation_event_count=excluded.mutation_event_count,trial_count=excluded.trial_count,usage_count=excluded.usage_count,verified_usage_count=excluded.verified_usage_count,provenance_count=excluded.provenance_count,conflict_count=excluded.conflict_count,open_conflict_count=excluded.open_conflict_count,lifecycle_event_count=excluded.lifecycle_event_count,lineage_coverage=excluded.lineage_coverage,lineage_state=excluded.lineage_state,lineage_snapshot=excluded.lineage_snapshot,refreshed_at=excluded.refreshed_at;
return jsonb_build_object('strategyId',p_strategy_id,'coverage',v_coverage,'state',v_state);end;$$;
create or replace function public.retrieve_james_meta_strategy_lineage(p_strategy_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;begin perform public.refresh_james_meta_strategy_lineage(p_strategy_id);
select jsonb_build_object('strategy',to_jsonb(s),'lineage',to_jsonb(l),'creationEvents',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.james_meta_strategy_mutation_events x where x.source_strategy_id=p_strategy_id),'[]'::jsonb),'trials',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.james_meta_strategy_trials x where x.strategy_id=p_strategy_id),'[]'::jsonb),'usage',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.james_meta_strategy_usage x where x.strategy_id=p_strategy_id),'[]'::jsonb),'provenance',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.james_meta_strategy_evidence_provenance x where x.strategy_id=p_strategy_id),'[]'::jsonb),'conflicts',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.james_meta_strategy_evidence_conflicts x where x.strategy_id=p_strategy_id),'[]'::jsonb),'lifecycleEvents',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.james_meta_strategy_lifecycle_events x where x.strategy_id=p_strategy_id),'[]'::jsonb)) into result from public.james_meta_strategies s join public.james_meta_strategy_lineage l on l.strategy_id=s.id where s.id=p_strategy_id;
return coalesce(result,jsonb_build_object('strategyId',p_strategy_id,'found',false));end;$$;
revoke all on function public.refresh_james_meta_strategy_lineage(uuid) from public,anon,authenticated;
revoke all on function public.retrieve_james_meta_strategy_lineage(uuid) from public,anon,authenticated;
grant execute on function public.refresh_james_meta_strategy_lineage(uuid) to service_role;
grant execute on function public.retrieve_james_meta_strategy_lineage(uuid) to service_role;