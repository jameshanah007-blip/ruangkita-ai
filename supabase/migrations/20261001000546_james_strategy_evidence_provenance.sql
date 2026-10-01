create table if not exists public.james_meta_strategy_evidence_provenance (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.james_meta_strategies(id) on delete cascade,
  trial_id uuid references public.james_meta_strategy_trials(id) on delete cascade,
  experiment_id uuid references public.james_game_experiments(id) on delete cascade,
  usage_id uuid references public.james_meta_strategy_usage(id) on delete set null,
  source_type text not null check (source_type in ('verification','usage','comparison','tournament','manual')),
  source_event_key text not null unique,
  quality_score numeric(6,4),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_strategy_provenance_strategy_idx on public.james_meta_strategy_evidence_provenance(strategy_id, created_at desc);
create index if not exists james_strategy_provenance_experiment_idx on public.james_meta_strategy_evidence_provenance(experiment_id, created_at desc);

alter table public.james_meta_strategy_evidence_provenance enable row level security;
revoke all on public.james_meta_strategy_evidence_provenance from public, anon, authenticated;
grant select, insert on public.james_meta_strategy_evidence_provenance to service_role;

alter table public.james_meta_strategy_trials add column if not exists provenance_id uuid references public.james_meta_strategy_evidence_provenance(id) on delete set null;
create index if not exists james_meta_strategy_trials_provenance_idx on public.james_meta_strategy_trials(provenance_id);

create or replace function public.record_james_strategy_evidence_provenance(
  p_strategy_id uuid,p_trial_id uuid,p_experiment_id uuid,p_usage_id uuid,
  p_source_type text,p_source_event_key text,p_quality_score numeric,p_provenance jsonb default '{}'::jsonb
)
returns public.james_meta_strategy_evidence_provenance
language plpgsql security invoker set search_path=public
as $$
declare v_row public.james_meta_strategy_evidence_provenance;
begin
  if p_source_type not in ('verification','usage','comparison','tournament','manual') then raise exception 'Invalid evidence provenance source type'; end if;
  insert into public.james_meta_strategy_evidence_provenance(strategy_id,trial_id,experiment_id,usage_id,source_type,source_event_key,quality_score,provenance)
  values(p_strategy_id,p_trial_id,p_experiment_id,p_usage_id,p_source_type,p_source_event_key,p_quality_score,coalesce(p_provenance,'{}'::jsonb))
  on conflict(source_event_key) do update set quality_score=excluded.quality_score,provenance=excluded.provenance
  returning * into v_row;
  if p_trial_id is not null then update public.james_meta_strategy_trials set provenance_id=v_row.id where id=p_trial_id; end if;
  return v_row;
end;
$$;

revoke all on function public.record_james_strategy_evidence_provenance(uuid,uuid,uuid,uuid,text,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.record_james_strategy_evidence_provenance(uuid,uuid,uuid,uuid,text,text,numeric,jsonb) to service_role;