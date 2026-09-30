-- Evidence aggregation is derived from durable trials, comparisons, and tournament memory.
-- Lifecycle status is intentionally not changed here.

create table if not exists public.james_meta_strategy_evidence (
  strategy_id uuid primary key,
  task_class text not null,
  trial_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  partial_count integer not null default 0,
  unknown_count integer not null default 0,
  avg_quality numeric(6,4) not null default 0,
  outcome_rate numeric(6,4) not null default 0,
  comparison_count integer not null default 0,
  comparison_improved_count integer not null default 0,
  avg_comparison_improvement numeric(8,4) not null default 0,
  tournament_count integer not null default 0,
  tournament_win_count integer not null default 0,
  avg_tournament_score numeric(6,4) not null default 0,
  avg_tournament_confidence numeric(6,4) not null default 0,
  confidence numeric(6,4) not null default 0,
  evidence_count integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  refreshed_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_evidence_task_idx
  on public.james_meta_strategy_evidence(task_class, confidence desc, refreshed_at desc);

alter table public.james_meta_strategy_evidence enable row level security;

create or replace function public.refresh_james_meta_strategy_evidence(p_strategy_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  t record;
  c record;
  m record;
  v_comparison_count integer := 0;
  v_comparison_improved integer := 0;
  v_avg_improvement numeric := 0;
  v_tournament_count integer := 0;
  v_tournament_wins integer := 0;
  v_avg_tournament_score numeric := 0;
  v_avg_tournament_confidence numeric := 0;
  v_outcome_rate numeric := 0;
  v_avg_quality numeric := 0;
  v_confidence numeric := 0;
  v_evidence_count integer := 0;
begin
  select id, task_class into s
    from public.james_meta_strategies
   where id = p_strategy_id;

  if s.id is null then
    return jsonb_build_object('refreshed', false, 'reason', 'strategy_not_found', 'strategyId', p_strategy_id);
  end if;

  select count(*)::integer as trial_count,
         count(*) filter (where outcome = 'success')::integer as success_count,
         count(*) filter (where outcome = 'failure')::integer as failure_count,
         count(*) filter (where outcome = 'partial')::integer as partial_count,
         count(*) filter (where outcome = 'unknown')::integer as unknown_count,
         coalesce(avg(quality), 0)::numeric as avg_quality,
         coalesce(avg(case
           when outcome = 'success' then 1
           when outcome = 'partial' then quality
           else 0
         end), 0)::numeric as outcome_rate
    into t
    from public.james_meta_strategy_trials
   where strategy_id = p_strategy_id;

  select count(*)::integer as comparison_count,
         count(*) filter (where case
           when evidence->'strategyComparison'->>'improvement' ~ '^-?[0-9]+(\\.[0-9]+)?$'
             then (evidence->'strategyComparison'->>'improvement')::numeric
           else 0
         end > 0)::integer as comparison_improved,
         coalesce(avg(case
           when evidence->'strategyComparison'->>'improvement' ~ '^-?[0-9]+(\\.[0-9]+)?$'
             then (evidence->'strategyComparison'->>'improvement')::numeric
           else null
         end), 0)::numeric as avg_improvement
    into c
    from public.james_meta_strategy_trials
   where strategy_id = p_strategy_id
     and evidence ? 'strategyComparison';

  select count(*)::integer as tournament_count,
         count(*) filter (where role = 'winner')::integer as tournament_wins,
         coalesce(avg(score), 0)::numeric as avg_score,
         coalesce(avg(confidence), 0)::numeric as avg_confidence
    into m
    from public.james_meta_strategy_tournament_memory
   where strategy_id = p_strategy_id;

  v_comparison_count := coalesce(c.comparison_count, 0);
  v_comparison_improved := coalesce(c.comparison_improved, 0);
  v_avg_improvement := greatest(-1, least(1, coalesce(c.avg_improvement, 0)));
  v_tournament_count := coalesce(m.tournament_count, 0);
  v_tournament_wins := coalesce(m.tournament_wins, 0);
  v_avg_tournament_score := greatest(0, least(1, coalesce(m.avg_score, 0)));
  v_avg_tournament_confidence := greatest(0, least(0.99, coalesce(m.avg_confidence, 0)));
  v_avg_quality := greatest(0, least(1, coalesce(t.avg_quality, 0)));
  v_outcome_rate := greatest(0, least(1, coalesce(t.outcome_rate, 0)));

  v_confidence := greatest(0, least(0.99,
    v_outcome_rate * 0.50 +
    v_avg_quality * 0.20 +
    case when v_comparison_count > 0
      then (v_comparison_improved::numeric / v_comparison_count) * 0.10
      else 0 end +
    case when v_tournament_count > 0
      then v_avg_tournament_confidence * 0.20
      else 0 end
  ));

  v_evidence_count := coalesce(t.trial_count, 0) + v_tournament_count;

  insert into public.james_meta_strategy_evidence (
    strategy_id, task_class, trial_count, success_count, failure_count,
    partial_count, unknown_count, avg_quality, outcome_rate,
    comparison_count, comparison_improved_count, avg_comparison_improvement,
    tournament_count, tournament_win_count, avg_tournament_score,
    avg_tournament_confidence, confidence, evidence_count, evidence
  )
  values (
    s.id, s.task_class, coalesce(t.trial_count, 0), coalesce(t.success_count, 0),
    coalesce(t.failure_count, 0), coalesce(t.partial_count, 0),
    coalesce(t.unknown_count, 0), v_avg_quality, v_outcome_rate,
    v_comparison_count, v_comparison_improved, v_avg_improvement,
    v_tournament_count, v_tournament_wins, v_avg_tournament_score,
    v_avg_tournament_confidence, v_confidence, v_evidence_count,
    jsonb_build_object(
      'strategyId', s.id,
      'taskClass', s.task_class,
      'trialCount', coalesce(t.trial_count, 0),
      'successCount', coalesce(t.success_count, 0),
      'failureCount', coalesce(t.failure_count, 0),
      'partialCount', coalesce(t.partial_count, 0),
      'unknownCount', coalesce(t.unknown_count, 0),
      'avgQuality', v_avg_quality,
      'outcomeRate', v_outcome_rate,
      'comparisonCount', v_comparison_count,
      'comparisonImprovedCount', v_comparison_improved,
      'avgComparisonImprovement', v_avg_improvement,
      'tournamentCount', v_tournament_count,
      'tournamentWinCount', v_tournament_wins,
      'avgTournamentScore', v_avg_tournament_score,
      'avgTournamentConfidence', v_avg_tournament_confidence,
      'confidence', v_confidence,
      'evidenceCount', v_evidence_count,
      'aggregationVersion', 1,
      'refreshedAt', now()
    )
  )
  on conflict (strategy_id) do update set
    task_class = excluded.task_class,
    trial_count = excluded.trial_count,
    success_count = excluded.success_count,
    failure_count = excluded.failure_count,
    partial_count = excluded.partial_count,
    unknown_count = excluded.unknown_count,
    avg_quality = excluded.avg_quality,
    outcome_rate = excluded.outcome_rate,
    comparison_count = excluded.comparison_count,
    comparison_improved_count = excluded.comparison_improved_count,
    avg_comparison_improvement = excluded.avg_comparison_improvement,
    tournament_count = excluded.tournament_count,
    tournament_win_count = excluded.tournament_win_count,
    avg_tournament_score = excluded.avg_tournament_score,
    avg_tournament_confidence = excluded.avg_tournament_confidence,
    confidence = excluded.confidence,
    evidence_count = excluded.evidence_count,
    evidence = excluded.evidence,
    refreshed_at = now();

  update public.james_meta_strategies
     set evidence_count = v_evidence_count,
         success_count = coalesce(t.success_count, 0),
         failure_count = coalesce(t.failure_count, 0),
         confidence = v_confidence,
         updated_at = now()
   where id = s.id;

  return jsonb_build_object(
    'refreshed', true,
    'strategyId', s.id,
    'taskClass', s.task_class,
    'evidenceCount', v_evidence_count,
    'confidence', v_confidence,
    'trialCount', coalesce(t.trial_count, 0),
    'comparisonCount', v_comparison_count,
    'tournamentCount', v_tournament_count
  );
end;
$$;

create or replace function public.refresh_all_james_meta_strategy_evidence()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_count integer := 0;
begin
  for s in select id from public.james_meta_strategies loop
    perform public.refresh_james_meta_strategy_evidence(s.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.retrieve_james_meta_strategy_evidence(
  p_task_class text,
  p_limit integer default 10
)
returns table(
  strategy_id uuid,
  task_class text,
  trial_count integer,
  success_count integer,
  failure_count integer,
  partial_count integer,
  avg_quality numeric,
  outcome_rate numeric,
  comparison_count integer,
  comparison_improved_count integer,
  tournament_count integer,
  tournament_win_count integer,
  avg_tournament_score numeric,
  confidence numeric,
  evidence_count integer,
  evidence jsonb,
  refreshed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select strategy_id, task_class, trial_count, success_count, failure_count,
         partial_count, avg_quality, outcome_rate, comparison_count,
         comparison_improved_count, tournament_count, tournament_win_count,
         avg_tournament_score, confidence, evidence_count, evidence, refreshed_at
    from public.james_meta_strategy_evidence
   where task_class = p_task_class
   order by confidence desc, evidence_count desc, refreshed_at desc
   limit greatest(1, least(coalesce(p_limit, 10), 20));
$$;

create or replace function public.refresh_james_meta_strategy_evidence_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_james_meta_strategy_evidence(new.strategy_id);
  return new;
end;
$$;

drop trigger if exists james_meta_strategy_evidence_trial_refresh
on public.james_meta_strategy_trials;

create trigger james_meta_strategy_evidence_trial_refresh
after insert or update of outcome, quality, evidence
on public.james_meta_strategy_trials
for each row
execute function public.refresh_james_meta_strategy_evidence_trigger();

drop trigger if exists james_meta_strategy_evidence_tournament_refresh
on public.james_meta_strategy_tournament_memory;

create trigger james_meta_strategy_evidence_tournament_refresh
after insert or update of role, score, confidence, evidence
on public.james_meta_strategy_tournament_memory
for each row
execute function public.refresh_james_meta_strategy_evidence_trigger();

revoke all on function public.refresh_james_meta_strategy_evidence(uuid)
from public, anon, authenticated;
revoke all on function public.refresh_all_james_meta_strategy_evidence()
from public, anon, authenticated;
revoke all on function public.retrieve_james_meta_strategy_evidence(text, integer)
from public, anon, authenticated;
revoke all on function public.refresh_james_meta_strategy_evidence_trigger()
from public, anon, authenticated;

grant execute on function public.refresh_james_meta_strategy_evidence(uuid) to service_role;
grant execute on function public.refresh_all_james_meta_strategy_evidence() to service_role;
grant execute on function public.retrieve_james_meta_strategy_evidence(text, integer) to service_role;
grant execute on function public.refresh_james_meta_strategy_evidence_trigger() to service_role;
