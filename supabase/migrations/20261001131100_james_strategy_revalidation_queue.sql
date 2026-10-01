-- James Strategy Revalidation Queue + Autonomous Synthesis Loop v1
-- Upgrade-safe bootstrap: production may already contain the legacy queue schema.
do $
begin
  if to_regclass('public.james_meta_strategy_revalidation_queue') is not null then
    -- Remove the legacy enqueue overload before its referenced legacy columns are removed.
    drop function if exists public.enqueue_james_meta_strategy_revalidation(integer,integer);

    alter table public.james_meta_strategy_revalidation_queue
      drop constraint if exists james_meta_strategy_revalidation_queue_strategy_id_fkey;

    alter table public.james_meta_strategy_revalidation_queue
      alter column strategy_id drop not null;

    alter table public.james_meta_strategy_revalidation_queue
      add column if not exists source_event_key text,
      add column if not exists state text,
      add column if not exists attempts integer,
      add column if not exists max_attempts integer,
      add column if not exists input_snapshot jsonb,
      add column if not exists result_snapshot jsonb,
      add column if not exists updated_at timestamptz;

    update public.james_meta_strategy_revalidation_queue
    set source_event_key = coalesce(source_event_key, 'legacy-revalidation:' || id::text),
        state = case
          when coalesce(status,'pending') in ('running','processing') then 'processing'
          when coalesce(status,'pending') in ('completed','done') then 'completed'
          when coalesce(status,'blocked','failed') in ('blocked','failed') then 'blocked'
          else 'pending'
        end,
        attempts = coalesce(attempts, 0),
        max_attempts = coalesce(max_attempts, 3),
        input_snapshot = coalesce(input_snapshot, evidence, '{}'::jsonb),
        result_snapshot = coalesce(result_snapshot, '{}'::jsonb),
        updated_at = coalesce(updated_at, created_at, now());

    -- Legacy queue IDs pointed at james_meta_strategy_synthesis. Re-link by
    -- task_class + strategy when a corresponding canonical strategy exists.
    update public.james_meta_strategy_revalidation_queue q
    set strategy_id = s.id
    from public.james_meta_strategy_synthesis old_s
    join public.james_meta_strategies s
      on s.task_class = old_s.task_class
     and s.strategy = old_s.strategy
    where q.strategy_id = old_s.id;

    -- Rows that cannot be mapped safely become unscoped revalidation jobs.
    update public.james_meta_strategy_revalidation_queue q
    set strategy_id = null
    where q.strategy_id is not null
      and not exists (
        select 1 from public.james_meta_strategies s where s.id = q.strategy_id
      );

    alter table public.james_meta_strategy_revalidation_queue
      alter column source_event_key set not null,
      alter column state set not null,
      alter column attempts set not null,
      alter column max_attempts set not null,
      alter column input_snapshot set not null,
      alter column result_snapshot set not null,
      alter column updated_at set not null;

    alter table public.james_meta_strategy_revalidation_queue
      alter column priority type integer
      using greatest(0, least(100, round(coalesce(priority,0.5) * 100)))::integer;

    update public.james_meta_strategy_revalidation_queue
    set priority = greatest(0, least(100, priority));

    -- Keep legacy status/scheduled_at/evidence columns for backward compatibility.
    -- The new state/input_snapshot fields are canonical for the revalidation worker.

    alter table public.james_meta_strategy_revalidation_queue
      add constraint james_meta_strategy_revalidation_queue_source_event_key_key
      unique (source_event_key);

    alter table public.james_meta_strategy_revalidation_queue
      add constraint james_meta_strategy_revalidation_queue_state_check
      check (state in ('pending','processing','completed','blocked'));

    alter table public.james_meta_strategy_revalidation_queue
      add constraint james_meta_strategy_revalidation_queue_attempts_check
      check (attempts >= 0);

    alter table public.james_meta_strategy_revalidation_queue
      add constraint james_meta_strategy_revalidation_queue_max_attempts_check
      check (max_attempts between 1 and 10);

    alter table public.james_meta_strategy_revalidation_queue
      add constraint james_meta_strategy_revalidation_queue_priority_check
      check (priority between 0 and 100);

    alter table public.james_meta_strategy_revalidation_queue
      add constraint james_meta_strategy_revalidation_queue_strategy_id_fkey
      foreign key (strategy_id) references public.james_meta_strategies(id) on delete set null;
  end if;
end;
$;

create table if not exists public.james_meta_strategy_revalidation_queue (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.james_meta_strategies(id) on delete set null,
  source_event_key text not null unique,
  reason text not null,
  priority integer not null default 50 check (priority between 0 and 100),
  state text not null default 'pending' check (state in ('pending','processing','completed','blocked')),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists james_meta_strategy_revalidation_queue_state_idx
  on public.james_meta_strategy_revalidation_queue(state, priority desc, created_at asc);
create index if not exists james_meta_strategy_revalidation_queue_strategy_idx
  on public.james_meta_strategy_revalidation_queue(strategy_id, state, created_at desc);

alter table public.james_meta_strategy_revalidation_queue enable row level security;

create or replace function public.enqueue_james_meta_strategy_revalidation(
  p_strategy_id uuid,
  p_source_event_key text,
  p_reason text,
  p_input_snapshot jsonb default '{}'::jsonb,
  p_priority integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  insert into public.james_meta_strategy_revalidation_queue(
    strategy_id, source_event_key, reason, priority, input_snapshot
  )
  values(
    p_strategy_id,
    p_source_event_key,
    coalesce(nullif(trim(p_reason),''),'revalidation_required'),
    greatest(0,least(100,coalesce(p_priority,50))),
    coalesce(p_input_snapshot,'{}'::jsonb)
  )
  on conflict(source_event_key) do update
    set updated_at=now()
  returning id into v_id;

  return jsonb_build_object(
    'queued', true,
    'id', v_id,
    'strategyId', p_strategy_id,
    'sourceEventKey', p_source_event_key
  );
end;
$$;

revoke all on function public.enqueue_james_meta_strategy_revalidation(uuid,text,text,jsonb,integer)
  from public,anon,authenticated;
grant execute on function public.enqueue_james_meta_strategy_revalidation(uuid,text,text,jsonb,integer)
  to service_role;

create or replace function public.claim_james_meta_strategy_revalidation(
  p_limit integer default 3
)
returns setof public.james_meta_strategy_revalidation_queue
language plpgsql
security definer
set search_path=public
as $$
begin
  return query
  with picked as (
    select id
    from public.james_meta_strategy_revalidation_queue
    where state='pending'
      and attempts < max_attempts
    order by priority desc, created_at asc
    for update skip locked
    limit greatest(1,least(10,coalesce(p_limit,3)))
  )
  update public.james_meta_strategy_revalidation_queue q
  set state='processing',
      attempts=q.attempts+1,
      claimed_at=now(),
      updated_at=now()
  from picked
  where q.id=picked.id
  returning q.*;
end;
$$;

revoke all on function public.claim_james_meta_strategy_revalidation(integer)
  from public,anon,authenticated;
grant execute on function public.claim_james_meta_strategy_revalidation(integer)
  to service_role;

create or replace function public.complete_james_meta_strategy_revalidation(
  p_id uuid,
  p_state text,
  p_result_snapshot jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_state text:=coalesce(p_state,'blocked');
begin
  if v_state not in ('completed','blocked','pending') then
    raise exception 'invalid revalidation state: %',v_state;
  end if;

  update public.james_meta_strategy_revalidation_queue
  set state=v_state,
      result_snapshot=coalesce(p_result_snapshot,'{}'::jsonb),
      updated_at=now(),
      completed_at=case when v_state in ('completed','blocked') then now() else null end
  where id=p_id;

  return jsonb_build_object('updated',found,'id',p_id,'state',v_state);
end;
$$;

revoke all on function public.complete_james_meta_strategy_revalidation(uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.complete_james_meta_strategy_revalidation(uuid,text,jsonb)
  to service_role;

-- Mutation safety now has a durable hand-off whenever evidence is insufficient.
create or replace function public.guard_james_meta_strategy_mutation(
  p_strategy_id uuid,
  p_mutation_type text,
  p_source_event_key text,
  p_min_trust numeric default .60,
  p_max_conflict_rate numeric default .20
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s record;
  e record;
  v_decision text;
  v_reason text;
  v_key text;
begin
  select * into s from public.james_meta_strategies where id=p_strategy_id;
  if s.id is null then
    return jsonb_build_object('allowed',false,'decision','blocked','reason','strategy_not_found','strategyId',p_strategy_id);
  end if;

  select * into e from public.james_meta_strategy_evidence where strategy_id=p_strategy_id;

  if e.strategy_id is null then
    v_decision:='requires_revalidation';
    v_reason:='evidence_not_available';
  elsif s.status='retired' then
    v_decision:='blocked';
    v_reason:='retired_strategy_is_immutable';
  elsif coalesce(e.conflict_count,0)>0
    and coalesce(e.resolved_conflict_count,0)<coalesce(e.conflict_count,0) then
    v_decision:='blocked';
    v_reason:='open_evidence_conflict';
  elsif coalesce(e.trust_score,0)<greatest(0,least(1,coalesce(p_min_trust,.60))) then
    v_decision:='requires_revalidation';
    v_reason:='insufficient_evidence_trust';
  elsif coalesce(e.conflict_rate,0)>greatest(0,least(1,coalesce(p_max_conflict_rate,.20))) then
    v_decision:='requires_revalidation';
    v_reason:='conflict_rate_above_mutation_threshold';
  else
    v_decision:='allowed';
    v_reason:='evidence_trust_and_conflict_gates_passed';
  end if;

  v_key:=coalesce(p_source_event_key,'mutation:'||p_strategy_id::text||':'||p_mutation_type);

  insert into public.james_meta_strategy_mutation_events(
    source_strategy_id,mutation_type,decision,source_event_key,evidence_snapshot,reason
  )
  values(
    p_strategy_id,p_mutation_type,v_decision,v_key,coalesce(to_jsonb(e),'{}'::jsonb),v_reason
  )
  on conflict(source_event_key) do nothing;

  if v_decision='requires_revalidation' then
    perform public.enqueue_james_meta_strategy_revalidation(
      p_strategy_id,
      'revalidation:'||v_key,
      v_reason,
      jsonb_build_object(
        'mutationType',p_mutation_type,
        'sourceEventKey',v_key,
        'trustScore',coalesce(e.trust_score,0),
        'conflictRate',coalesce(e.conflict_rate,0)
      ),
      case when v_reason='insufficient_evidence_trust' then 80 else 70 end
    );
  end if;

  return jsonb_build_object(
    'allowed',v_decision='allowed',
    'decision',v_decision,
    'reason',v_reason,
    'strategyId',p_strategy_id,
    'mutationType',p_mutation_type,
    'trustScore',coalesce(e.trust_score,0),
    'conflictRate',coalesce(e.conflict_rate,0),
    'openConflictCount',greatest(0,coalesce(e.conflict_count,0)-coalesce(e.resolved_conflict_count,0))
  );
end;
$$;

revoke all on function public.guard_james_meta_strategy_mutation(uuid,text,text,numeric,numeric)
  from public,anon,authenticated;
grant execute on function public.guard_james_meta_strategy_mutation(uuid,text,text,numeric,numeric)
  to service_role;

-- Low-confidence creation requests also become durable revalidation work,
-- but cannot synthesize without a strategy/evidence context.
create or replace function public.guard_james_meta_strategy_creation(
  p_task_class text,
  p_strategy text,
  p_confidence numeric,
  p_source_event_key text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_decision text;v_reason text;v_key text;
begin
  if coalesce(length(trim(p_task_class)),0)=0 or coalesce(length(trim(p_strategy)),0)=0 then
    v_decision:='blocked';v_reason:='invalid_strategy_payload';
  elsif coalesce(p_confidence,0)<.75 then
    v_decision:='requires_revalidation';v_reason:='model_confidence_below_creation_threshold';
  else
    v_decision:='allowed';v_reason:='verified_meta_learning_payload_passed_creation_gate';
  end if;

  v_key:=coalesce(p_source_event_key,'creation:'||md5(coalesce(p_task_class,'')||':'||coalesce(p_strategy,'')));

  insert into public.james_meta_strategy_mutation_events(
    source_strategy_id,mutation_type,decision,source_event_key,evidence_snapshot,reason
  )
  values(
    null,'create',v_decision,v_key,
    jsonb_build_object('taskClass',p_task_class,'strategy',p_strategy,'confidence',p_confidence),
    v_reason
  )
  on conflict(source_event_key) do nothing;

  if v_decision='requires_revalidation' then
    perform public.enqueue_james_meta_strategy_revalidation(
      null,
      'revalidation:'||v_key,
      v_reason,
      jsonb_build_object(
        'taskClass',p_task_class,
        'strategy',p_strategy,
        'confidence',p_confidence,
        'sourceEventKey',v_key
      ),
      40
    );
  end if;

  return jsonb_build_object(
    'allowed',v_decision='allowed',
    'decision',v_decision,
    'reason',v_reason,
    'taskClass',p_task_class,
    'confidence',p_confidence
  );
end;
$$;

revoke all on function public.guard_james_meta_strategy_creation(text,text,numeric,text)
  from public,anon,authenticated;
grant execute on function public.guard_james_meta_strategy_creation(text,text,numeric,text)
  to service_role;
