-- James Game Learning Atomic Consolidation Updates v1
-- Serialize duplicate Game Brain consolidation events at the database boundary.

create or replace function public.record_james_game_consolidation_event(
  p_pattern text,
  p_strategy text,
  p_capabilities jsonb,
  p_quality numeric,
  p_event_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.james_experience_consolidations%rowtype;
  v_old_evidence integer;
  v_next_evidence integer;
  v_next_confidence numeric;
  v_merged_capabilities jsonb;
begin
  if nullif(trim(p_event_key), '') is null then
    raise exception 'p_event_key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'consolidation|' || coalesce(p_pattern, 'fun-zone-game-brain') || '|system',
      0
    )
  );

  select *
    into v_existing
    from public.james_experience_consolidations
   where user_id is null
     and merged_pattern = p_pattern
     and status = 'active'
   order by created_at asc
   limit 1
   for update;

  if found then
    if v_existing.last_source_event_key = p_event_key then
      return jsonb_build_object('applied', false, 'duplicate', true, 'id', v_existing.id, 'evidence_count', v_existing.evidence_count);
    end if;

    v_old_evidence := coalesce(v_existing.evidence_count, 0);
    v_next_evidence := v_old_evidence + 1;
    v_next_confidence := greatest(0.05, least(0.99,
      coalesce(v_existing.confidence, 0.5) * 0.35 + greatest(0, least(1, p_quality)) * 0.65
    ));

    select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
      into v_merged_capabilities
      from jsonb_array_elements(
        case
          when jsonb_typeof(coalesce(v_existing.capabilities, '[]'::jsonb)) = 'array'
            then coalesce(v_existing.capabilities, '[]'::jsonb)
          else '[]'::jsonb
        end ||
        case
          when jsonb_typeof(coalesce(p_capabilities, '[]'::jsonb)) = 'array'
            then coalesce(p_capabilities, '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as elements(value);

    update public.james_experience_consolidations
       set evidence_count = v_next_evidence,
           confidence = v_next_confidence,
           capabilities = v_merged_capabilities,
           merged_strategy = p_strategy,
           last_source_event_key = p_event_key,
           updated_at = now()
     where id = v_existing.id;

    return jsonb_build_object('applied', true, 'duplicate', false, 'id', v_existing.id, 'evidence_count', v_next_evidence);
  end if;

  insert into public.james_experience_consolidations (
    user_id, source_experience_ids, merged_pattern, merged_strategy,
    capabilities, confidence, evidence_count, status, last_source_event_key
  ) values (
    null,
    '[]'::jsonb,
    p_pattern,
    p_strategy,
    case
      when jsonb_typeof(coalesce(p_capabilities, '[]'::jsonb)) = 'array'
        then coalesce(p_capabilities, '[]'::jsonb)
      else '[]'::jsonb
    end,
    greatest(0.05, least(0.99, p_quality)),
    1,
    'active',
    p_event_key
  )
  returning id into v_existing.id;

  return jsonb_build_object('applied', true, 'duplicate', false, 'id', v_existing.id);
end;
$$;

revoke execute on function public.record_james_game_consolidation_event(text,text,jsonb,numeric,text) from public, anon, authenticated;
grant execute on function public.record_james_game_consolidation_event(text,text,jsonb,numeric,text) to service_role;
