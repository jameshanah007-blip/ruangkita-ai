create table if not exists public.james_meta_strategy_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null,
  previous_status text not null check (previous_status in ('candidate','active','retired')),
  next_status text not null check (next_status in ('candidate','active','retired')),
  evidence_fingerprint text not null,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  reason text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists james_meta_strategy_lifecycle_event_uidx
  on public.james_meta_strategy_lifecycle_events(strategy_id, evidence_fingerprint);

create index if not exists james_meta_strategy_lifecycle_events_strategy_idx
  on public.james_meta_strategy_lifecycle_events(strategy_id, created_at desc);

alter table public.james_meta_strategy_lifecycle_events enable row level security;

create or replace function public.reconcile_james_meta_strategy_lifecycle(
  p_strategy_id uuid,
  p_min_samples integer default 4,
  p_promote_score numeric default 0.75,
  p_retire_score numeric default 0.35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  e record;
  v_min_samples integer := greatest(1, coalesce(p_min_samples, 4));
  v_promote_score numeric := greatest(0, least(1, coalesce(p_promote_score, 0.75)));
  v_retire_score numeric := greatest(0, least(v_promote_score, coalesce(p_retire_score, 0.35)));
  v_score numeric := 0;
  v_next_status text;
  v_reason text;
  v_fingerprint text;
  v_event_id uuid;
  v_changed boolean := false;
begin
  select id, task_class, status, evidence_count, success_count, failure_count, confidence
    into s
    from public.james_meta_strategies
   where id = p_strategy_id
   for update;

  if s.id is null then
    return jsonb_build_object(
      'reconciled', false,
      'reason', 'strategy_not_found',
      'strategyId', p_strategy_id
    );
  end if;

  select *
    into e
    from public.james_meta_strategy_evidence
   where strategy_id = p_strategy_id;

  if e.strategy_id is null then
    return jsonb_build_object(
      'reconciled', false,
      'reason', 'evidence_not_available',
      'strategyId', p_strategy_id,
      'status', s.status
    );
  end if;

  v_score := greatest(0, least(1,
    coalesce(e.outcome_rate, 0) * 0.55 +
    coalesce(e.avg_quality, 0) * 0.20 +
    coalesce(e.confidence, 0) * 0.25
  ));

  v_fingerprint := md5(jsonb_build_object(
    'strategyId', e.strategy_id,
    'taskClass', e.task_class,
    'evidenceCount', e.evidence_count,
    'trialCount', e.trial_count,
    'successCount', e.success_count,
    'failureCount', e.failure_count,
    'comparisonCount', e.comparison_count,
    'tournamentCount', e.tournament_count,
    'tournamentWinCount', e.tournament_win_count,
    'confidence', e.confidence,
    'score', v_score
  )::text);

  v_next_status := s.status;
  v_reason := 'insufficient evidence for lifecycle transition';

  if e.evidence_count < v_min_samples then
    v_next_status := s.status;
    v_reason := 'minimum evidence threshold not reached';
  elsif s.status = 'candidate' and v_score >= v_promote_score then
    v_next_status := 'active';
    v_reason := 'candidate met empirical promotion threshold';
  elsif s.status = 'active' and v_score <= v_retire_score then
    v_next_status := 'retired';
    v_reason := 'active strategy fell below empirical retirement threshold';
  elsif s.status = 'retired' then
    -- Retirement is sticky. A retired strategy remains historical evidence;
    -- new mutations must create a new candidate rather than resurrecting it.
    v_next_status := 'retired';
    v_reason := 'retired strategies remain historical evidence';
  else
    v_next_status := s.status;
    v_reason := 'evidence does not cross a lifecycle threshold';
  end if;

  insert into public.james_meta_strategy_lifecycle_events(
    strategy_id,
    previous_status,
    next_status,
    evidence_fingerprint,
    evidence_snapshot,
    reason
  )
  values(
    s.id,
    s.status,
    v_next_status,
    v_fingerprint,
    jsonb_build_object(
      'taskClass', e.task_class,
      'evidenceCount', e.evidence_count,
      'trialCount', e.trial_count,
      'successCount', e.success_count,
      'failureCount', e.failure_count,
      'comparisonCount', e.comparison_count,
      'comparisonImprovedCount', e.comparison_improved_count,
      'tournamentCount', e.tournament_count,
      'tournamentWinCount', e.tournament_win_count,
      'outcomeRate', e.outcome_rate,
      'avgQuality', e.avg_quality,
      'confidence', e.confidence,
      'score', v_score,
      'minimumSamples', v_min_samples,
      'promoteScore', v_promote_score,
      'retireScore', v_retire_score
    ),
    v_reason
  )
  on conflict (strategy_id, evidence_fingerprint) do nothing
  returning id into v_event_id;

  if v_next_status <> s.status then
    update public.james_meta_strategies
       set status = v_next_status,
           updated_at = now()
     where id = s.id;
    v_changed := true;
  end if;

  return jsonb_build_object(
    'reconciled', true,
    'changed', v_changed,
    'strategyId', s.id,
    'previousStatus', s.status,
    'status', v_next_status,
    'score', v_score,
    'evidenceCount', e.evidence_count,
    'confidence', e.confidence,
    'reason', v_reason,
    'eventId', v_event_id,
    'idempotent', v_event_id is null
  );
end;
$$;

create or replace function public.reconcile_all_james_meta_strategy_lifecycle(
  p_min_samples integer default 4,
  p_promote_score numeric default 0.75,
  p_retire_score numeric default 0.35
)
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
    perform public.reconcile_james_meta_strategy_lifecycle(
      s.id,
      p_min_samples,
      p_promote_score,
      p_retire_score
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.reconcile_james_meta_strategy_lifecycle(uuid,integer,numeric,numeric)
from public, anon, authenticated;

revoke all on function public.reconcile_all_james_meta_strategy_lifecycle(integer,numeric,numeric)
from public, anon, authenticated;

grant execute on function public.reconcile_james_meta_strategy_lifecycle(uuid,integer,numeric,numeric)
to service_role;

grant execute on function public.reconcile_all_james_meta_strategy_lifecycle(integer,numeric,numeric)
to service_role;
