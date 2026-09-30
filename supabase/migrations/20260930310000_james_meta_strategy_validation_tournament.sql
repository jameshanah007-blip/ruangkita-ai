create table if not exists public.james_meta_strategy_trials (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null,
  scenario_key text not null,
  outcome text not null check (outcome in ('success','failure','partial','unknown')),
  quality numeric(5,4) not null default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_trials_strategy_idx
  on public.james_meta_strategy_trials(strategy_id,created_at desc);

create table if not exists public.james_meta_strategy_tournaments (
  id uuid primary key default gen_random_uuid(),
  task_class text not null,
  strategy_ids jsonb not null default '[]'::jsonb,
  winner_strategy_id uuid,
  winner_score numeric(6,4),
  sample_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending','completed','inconclusive')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.james_meta_strategy_trials enable row level security;
alter table public.james_meta_strategy_tournaments enable row level security;

create or replace function public.evaluate_james_meta_strategy_tournament(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  s record;
  v_score numeric;
  v_best numeric := -1;
  v_winner uuid := null;
  v_samples integer := 0;
  v_count integer := 0;
begin
  select * into t from public.james_meta_strategy_tournaments where id=p_tournament_id for update;
  if t.id is null then return jsonb_build_object('completed',false,'reason','tournament_not_found'); end if;

  for s in
    select m.id,
      coalesce(avg(case when tr.outcome='success' then 1 when tr.outcome='partial' then tr.quality else 0 end),0) as outcome_score,
      count(tr.id) as samples,
      coalesce(avg(tr.quality),0.5) as quality
    from public.james_meta_strategy_synthesis m
    left join public.james_meta_strategy_trials tr on tr.strategy_id=m.id
    where m.id in (select jsonb_array_elements_text(t.strategy_ids)::uuid)
    group by m.id
  loop
    v_score := s.outcome_score*0.70 + s.quality*0.30;
    if s.samples >= 2 and v_score > v_best then
      v_best := v_score;
      v_winner := s.id;
    end if;
    v_samples := v_samples + s.samples;
    v_count := v_count + 1;
  end loop;

  if v_winner is null then
    update public.james_meta_strategy_tournaments
    set status='inconclusive',sample_count=v_samples,evidence=jsonb_build_object('candidateCount',v_count),winner_strategy_id=null,winner_score=null
    where id=p_tournament_id;
    return jsonb_build_object('completed',false,'status','inconclusive','sampleCount',v_samples);
  end if;

  update public.james_meta_strategy_synthesis
  set status='validated',updated_at=now()
  where id=v_winner;

  update public.james_meta_strategy_tournaments
  set status='completed',winner_strategy_id=v_winner,winner_score=v_best,sample_count=v_samples,
      evidence=jsonb_build_object('candidateCount',v_count,'minimumSamplesPerStrategy',2)
  where id=p_tournament_id;

  return jsonb_build_object('completed',true,'winnerStrategyId',v_winner,'winnerScore',v_best,'sampleCount',v_samples);
end;
$$;

revoke all on function public.evaluate_james_meta_strategy_tournament(uuid)
from public,anon,authenticated;
grant execute on function public.evaluate_james_meta_strategy_tournament(uuid)
to service_role;
