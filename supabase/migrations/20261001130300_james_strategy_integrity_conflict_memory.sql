-- Persist strategy integrity mismatches as auditable evidence conflicts.
alter table public.james_meta_strategy_evidence_conflicts
  add column if not exists integrity_context jsonb not null default '{}'::jsonb;

create or replace function public.record_james_strategy_integrity_conflict(
  p_strategy_id uuid,
  p_experiment_id uuid,
  p_attempt integer,
  p_expected_fingerprint text,
  p_selected_fingerprint text,
  p_executed_fingerprint text,
  p_verified_fingerprint text
)
returns public.james_meta_strategy_evidence_conflicts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.james_meta_strategy_evidence_conflicts;
  v_key text;
begin
  v_key := 'integrity:' || p_experiment_id::text || ':' ||
    greatest(coalesce(p_attempt,0),0)::text || ':' || p_strategy_id::text;

  insert into public.james_meta_strategy_evidence_conflicts(
    strategy_id,
    conflict_type,
    severity,
    resolution_state,
    source_event_key,
    integrity_context
  )
  values (
    p_strategy_id,
    'verification_lineage_mismatch',
    'high',
    'open',
    v_key,
    jsonb_build_object(
      'source','strategy-integrity-verification',
      'experimentId',p_experiment_id,
      'attempt',greatest(coalesce(p_attempt,0),0),
      'expectedFingerprint',p_expected_fingerprint,
      'selectedFingerprint',p_selected_fingerprint,
      'executedFingerprint',p_executed_fingerprint,
      'verifiedFingerprint',p_verified_fingerprint
    )
  )
  on conflict (source_event_key) do update
    set integrity_context=excluded.integrity_context
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_james_strategy_integrity_conflict(uuid,uuid,integer,text,text,text,text)
from public, anon, authenticated;
grant execute on function public.record_james_strategy_integrity_conflict(uuid,uuid,integer,text,text,text,text)
to service_role;
