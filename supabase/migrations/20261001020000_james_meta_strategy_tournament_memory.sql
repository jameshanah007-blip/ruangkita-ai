create table if not exists public.james_meta_strategy_tournaments (
  id uuid primary key default gen_random_uuid(),
  task_class text not null,
  strategy_ids jsonb not null default '[]'::jsonb,
  winner_strategy_id uuid,
  winner_score numeric(6,4),
  sample_count integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending','completed','inconclusive')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists james_meta_strategy_tournaments_task_idx
  on public.james_meta_strategy_tournaments(task_class, created_at desc);

alter table public.james_meta_strategy_tournaments enable row level security;

create table if not exists public.james_meta_strategy_tournament_memory (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  task_class text not null,
  strategy_id uuid not null,
  role text not null check (role in ('candidate','winner','incumbent')),
  score numeric(6,4) not null default 0,
  sample_count integer not null default 0,
  outcome_rate numeric(6,4) not null default 0,
  quality numeric(6,4) not null default 0,
  confidence numeric(6,4) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists james_meta_strategy_tournament_memory_unique_idx
  on public.james_meta_strategy_tournament_memory(tournament_id, strategy_id);

create index if not exists james_meta_strategy_tournament_memory_lookup_idx
  on public.james_meta_strategy_tournament_memory(task_class, score desc, created_at desc);

alter table public.james_meta_strategy_tournament_memory enable row level security;

create or replace function public.finalize_james_meta_strategy_tournament(
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
  v_memory_count integer := 0;
begin
  select *
    into t
    from public.james_meta_strategy_tournaments
   where id = p_tournament_id
   for update;

  if t.id is null then
    return jsonb_build_object('completed', false, 'reason', 'tournament_not_found');
  end if;

  -- A completed tournament is immutable at the outcome layer.
  if t.status = 'completed' then
    return jsonb_build_object(
      'completed', true,
      'status', t.status,
      'winnerStrategyId', t.winner_strategy_id,
      'winnerScore', t.winner_score,
      'sampleCount', t.sample_count,
      'replayed', true
    );
  end if;

  for s in
    select
      m.id,
      coalesce(avg(
        case
          when tr.outcome = 'success' then 1
          when tr.outcome = 'partial' then tr.quality
          else 0
        end
      ), 0) as outcome_score,
      count(tr.id)::integer as samples,
      coalesce(avg(tr.quality), 0.5) as avg_quality,
      case
        when count(tr.id) > 0 then
          avg(case when tr.outcome = 'success' then 1 when tr.outcome = 'partial' then 0.5 else 0 end)
        else 0
      end as outcome_rate
    from public.james_meta_strategy_synthesis m
    left join public.james_meta_strategy_trials tr
      on tr.strategy_id = m.id
    where m.id in (
      select jsonb_array_elements_text(t.strategy_ids)::uuid
    )
    group by m.id
  loop
    v_score := greatest(0, least(1,
      s.outcome_score * 0.70 +
      s.avg_quality * 0.20 +
      least(1, s.samples::numeric / 5) * 0.10
    ));

    insert into public.james_meta_strategy_tournament_memory(
      tournament_id,
      task_class,
      strategy_id,
      role,
      score,
      sample_count,
      outcome_rate,
      quality,
      confidence,
      evidence
    )
    values(
      t.id,
      t.task_class,
      s.id,
      'candidate',
      v_score,
      s.samples,
      s.outcome_rate,
      s.avg_quality,
      greatest(0, least(0.99,
        s.outcome_rate * 0.7 +
        s.avg_quality * 0.2 +
        least(1, s.samples::numeric / 5) * 0.1
      )),
      jsonb_build_object(
        'tournamentId', t.id,
        'taskClass', t.task_class,
        'strategyId', s.id,
        'sampleCount', s.samples,
        'outcomeRate', s.outcome_rate,
        'quality', s.avg_quality,
        'score', v_score,
        'recordedAt', now()
      )
    )
    on conflict (tournament_id, strategy_id)
    do update set
      score = excluded.score,
      sample_count = excluded.sample_count,
      outcome_rate = excluded.outcome_rate,
      quality = excluded.quality,
      confidence = excluded.confidence,
      evidence = excluded.evidence;

    v_memory_count := v_memory_count + 1;

    if s.samples >= 2 and v_score > v_best then
      v_best := v_score;
      v_winner := s.id;
    end if;

    v_samples := v_samples + s.samples;
    v_count := v_count + 1;
  end loop;

  if v_winner is null then
    update public.james_meta_strategy_tournaments
       set status = 'inconclusive',
           sample_count = v_samples,
           evidence = jsonb_build_object(
             'candidateCount', v_count,
             'memoryRows', v_memory_count,
             'minimumSamplesPerStrategy', 2
           ),
           completed_at = now()
     where id = t.id;

    return jsonb_build_object(
      'completed', false,
      'status', 'inconclusive',
      'sampleCount', v_samples,
      'memoryRows', v_memory_count
    );
  end if;

  update public.james_meta_strategy_tournament_memory
     set role = case when strategy_id = v_winner then 'winner' else 'candidate' end
   where tournament_id = t.id;

  update public.james_meta_strategy_tournaments
     set status = 'completed',
         winner_strategy_id = v_winner,
         winner_score = v_best,
         sample_count = v_samples,
         evidence = jsonb_build_object(
           'candidateCount', v_count,
           'memoryRows', v_memory_count,
           'minimumSamplesPerStrategy', 2,
           'winnerScore', v_best,
           'winnerSelection', 'empirical-evidence'
         ),
         completed_at = now()
   where id = t.id;

  return jsonb_build_object(
    'completed', true,
    'status', 'completed',
    'winnerStrategyId', v_winner,
    'winnerScore', v_best,
    'sampleCount', v_samples,
    'memoryRows', v_memory_count
  );
end;
$$;

create or replace function public.retrieve_james_meta_strategy_tournament_memory(
  p_task_class text,
  p_limit integer default 5
)
returns table(
  tournament_id uuid,
  strategy_id uuid,
  role text,
  score numeric,
  sample_count integer,
  outcome_rate numeric,
  quality numeric,
  confidence numeric,
  evidence jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    tournament_id,
    strategy_id,
    role,
    score,
    sample_count,
    outcome_rate,
    quality,
    confidence,
    evidence
  from public.james_meta_strategy_tournament_memory
  where task_class = p_task_class
    and role in ('winner', 'incumbent')
  order by score desc, confidence desc, created_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

revoke all on function public.finalize_james_meta_strategy_tournament(uuid)
from public, anon, authenticated;

revoke all on function public.retrieve_james_meta_strategy_tournament_memory(text, integer)
from public, anon, authenticated;

grant execute on function public.finalize_james_meta_strategy_tournament(uuid)
to service_role;

grant execute on function public.retrieve_james_meta_strategy_tournament_memory(text, integer)
to service_role;
