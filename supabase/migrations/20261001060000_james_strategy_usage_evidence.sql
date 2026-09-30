create table if not exists public.james_meta_strategy_usage (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.james_meta_strategies(id) on delete cascade,
  experiment_id uuid not null references public.james_game_experiments(id) on delete cascade,
  attempt integer not null default 0,
  usage_state text not null check (usage_state in ('selected','executed','verified')),
  source_event_key text not null unique,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_usage_strategy_idx
  on public.james_meta_strategy_usage(strategy_id, created_at desc);

create index if not exists james_meta_strategy_usage_experiment_idx
  on public.james_meta_strategy_usage(experiment_id, attempt);

alter table public.james_meta_strategy_usage enable row level security;

revoke all on public.james_meta_strategy_usage from public, anon, authenticated;
grant select, insert on public.james_meta_strategy_usage to service_role;

create or replace function public.record_james_meta_strategy_usage(
  p_strategy_id uuid,
  p_experiment_id uuid,
  p_attempt integer,
  p_usage_state text,
  p_evidence jsonb default '{}'::jsonb
)
returns public.james_meta_strategy_usage
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.james_meta_strategy_usage;
  v_key text;
begin
  if p_usage_state not in ('selected','executed','verified') then
    raise exception 'Invalid strategy usage state';
  end if;

  v_key := p_experiment_id::text || ':' || p_strategy_id::text || ':' || greatest(coalesce(p_attempt,0),0)::text || ':' || p_usage_state;

  insert into public.james_meta_strategy_usage(
    strategy_id, experiment_id, attempt, usage_state, source_event_key, evidence
  )
  values (
    p_strategy_id, p_experiment_id, greatest(coalesce(p_attempt,0),0),
    p_usage_state, v_key, coalesce(p_evidence,'{}'::jsonb)
  )
  on conflict (source_event_key) do update
    set evidence = excluded.evidence
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_james_meta_strategy_usage(uuid,uuid,integer,text,jsonb)
from public, anon, authenticated;
grant execute on function public.record_james_meta_strategy_usage(uuid,uuid,integer,text,jsonb)
to service_role;