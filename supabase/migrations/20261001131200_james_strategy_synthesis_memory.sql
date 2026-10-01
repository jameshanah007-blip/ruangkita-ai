-- James Strategy Synthesis Memory v1
-- Upgrade-safe: production may already contain the legacy synthesis table.
do $$
begin
  if to_regclass('public.james_meta_strategy_synthesis') is not null then
    alter table public.james_meta_strategy_synthesis
      add column if not exists revalidation_id uuid,
      add column if not exists source_strategy_id uuid,
      add column if not exists candidate_strategy_id uuid,
      add column if not exists source_event_key text,
      add column if not exists source_strategy text,
      add column if not exists synthesized_strategy text,
      add column if not exists capabilities jsonb,
      add column if not exists source_evidence_snapshot jsonb,
      add column if not exists synthesis_reason text,
      add column if not exists model_confidence numeric(6,4),
      add column if not exists decision text,
      add column if not exists updated_at timestamptz;

    -- Preserve legacy rows before removing legacy-only columns.
    update public.james_meta_strategy_synthesis s
    set source_event_key = coalesce(s.source_event_key, 'legacy-synthesis:' || s.id::text),
        source_strategy = coalesce(s.source_strategy, s.strategy, ''),
        synthesized_strategy = coalesce(s.synthesized_strategy, s.strategy, ''),
        capabilities = coalesce(s.capabilities, '[]'::jsonb),
        source_evidence_snapshot = coalesce(
          s.source_evidence_snapshot,
          jsonb_build_object(
            'legacyStrategyKey', s.strategy_key,
            'sourcePatterns', coalesce(s.source_patterns,'[]'::jsonb),
            'evidenceCount', coalesce(s.evidence_count,0),
            'successCount', coalesce(s.success_count,0),
            'failureCount', coalesce(s.failure_count,0),
            'confidence', coalesce(s.confidence,0)
          )
        ),
        synthesis_reason = coalesce(s.synthesis_reason, 'legacy_synthesis_migrated'),
        model_confidence = greatest(0, least(.99, coalesce(s.model_confidence, s.confidence, 0))),
        decision = case
          when coalesce(s.decision,'') in ('candidate_created','duplicate_reused','blocked')
            then s.decision
          else 'candidate_created'
        end,
        updated_at = coalesce(s.updated_at, s.created_at, now());

    -- Link legacy text-only synthesis records to canonical strategies where possible.
    update public.james_meta_strategy_synthesis s
    set source_strategy_id = coalesce(s.source_strategy_id, src.id),
        candidate_strategy_id = coalesce(s.candidate_strategy_id, cand.id)
    from public.james_meta_strategies src
    left join public.james_meta_strategies cand
      on cand.task_class = s.task_class
     and cand.strategy = s.strategy
     and cand.status <> 'retired'
    where s.source_strategy_id is null
      and src.task_class = s.task_class
      and src.strategy = s.strategy
      and src.status <> 'retired';

    -- Legacy synthesis columns remain for backward compatibility.
    -- New fields below are the canonical revalidation/synthesis contract.

    alter table public.james_meta_strategy_synthesis
      alter column source_event_key set not null,
      alter column task_class set not null,
      alter column source_strategy set not null,
      alter column synthesized_strategy set not null,
      alter column capabilities set not null,
      alter column source_evidence_snapshot set not null,
      alter column synthesis_reason set not null,
      alter column model_confidence set not null,
      alter column decision set not null,
      alter column created_at set default now();

    alter table public.james_meta_strategy_synthesis
      add constraint james_meta_strategy_synthesis_decision_check
      check (decision in ('candidate_created','duplicate_reused','blocked'));

    alter table public.james_meta_strategy_synthesis
      add constraint james_meta_strategy_synthesis_source_event_key_key
      unique (source_event_key);

    alter table public.james_meta_strategy_synthesis
      add constraint james_meta_strategy_synthesis_revalidation_id_fkey
      foreign key (revalidation_id)
      references public.james_meta_strategy_revalidation_queue(id)
      on delete set null;

    alter table public.james_meta_strategy_synthesis
      add constraint james_meta_strategy_synthesis_source_strategy_id_fkey
      foreign key (source_strategy_id)
      references public.james_meta_strategies(id)
      on delete set null;

    alter table public.james_meta_strategy_synthesis
      add constraint james_meta_strategy_synthesis_candidate_strategy_id_fkey
      foreign key (candidate_strategy_id)
      references public.james_meta_strategies(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists public.james_meta_strategy_synthesis (
  id uuid primary key default gen_random_uuid(),
  revalidation_id uuid references public.james_meta_strategy_revalidation_queue(id) on delete set null,
  source_strategy_id uuid references public.james_meta_strategies(id) on delete set null,
  candidate_strategy_id uuid references public.james_meta_strategies(id) on delete set null,
  source_event_key text not null unique,
  task_class text not null,
  source_strategy text not null,
  synthesized_strategy text not null,
  capabilities jsonb not null default '[]'::jsonb,
  source_evidence_snapshot jsonb not null default '{}'::jsonb,
  synthesis_reason text not null default '',
  model_confidence numeric(6,4) not null default 0,
  decision text not null check (decision in ('candidate_created','duplicate_reused','blocked')),
  created_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_synthesis_source_idx
  on public.james_meta_strategy_synthesis(source_strategy_id,created_at desc);
create index if not exists james_meta_strategy_synthesis_candidate_idx
  on public.james_meta_strategy_synthesis(candidate_strategy_id,created_at desc);

alter table public.james_meta_strategy_synthesis enable row level security;

revoke all on table public.james_meta_strategy_synthesis from public,anon,authenticated;
create or replace function public.record_james_meta_strategy_synthesis(
  p_revalidation_id uuid,
  p_source_strategy_id uuid,
  p_candidate_strategy_id uuid,
  p_source_event_key text,
  p_task_class text,
  p_source_strategy text,
  p_synthesized_strategy text,
  p_capabilities jsonb,
  p_source_evidence_snapshot jsonb,
  p_synthesis_reason text,
  p_model_confidence numeric,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  if p_decision not in ('candidate_created','duplicate_reused','blocked') then
    raise exception 'invalid synthesis decision: %',p_decision;
  end if;

  insert into public.james_meta_strategy_synthesis(
    revalidation_id,source_strategy_id,candidate_strategy_id,source_event_key,
    task_class,source_strategy,synthesized_strategy,capabilities,
    source_evidence_snapshot,synthesis_reason,model_confidence,decision
  )
  values(
    p_revalidation_id,p_source_strategy_id,p_candidate_strategy_id,p_source_event_key,
    coalesce(nullif(trim(p_task_class),''),'unknown'),
    coalesce(p_source_strategy,''),
    coalesce(p_synthesized_strategy,''),
    coalesce(p_capabilities,'[]'::jsonb),
    coalesce(p_source_evidence_snapshot,'{}'::jsonb),
    coalesce(p_synthesis_reason,''),
    greatest(0,least(.99,coalesce(p_model_confidence,0))),
    p_decision
  )
  on conflict(source_event_key) do update set
    candidate_strategy_id=coalesce(excluded.candidate_strategy_id,james_meta_strategy_synthesis.candidate_strategy_id),
    decision=excluded.decision,
    created_at=james_meta_strategy_synthesis.created_at
  returning id into v_id;

  return jsonb_build_object('recorded',true,'id',v_id,'decision',p_decision);
end;
$$;

revoke all on function public.record_james_meta_strategy_synthesis(uuid,uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)
from public,anon,authenticated;
grant execute on function public.record_james_meta_strategy_synthesis(uuid,uuid,uuid,text,text,text,jsonb,jsonb,text,numeric,text)
to service_role;
