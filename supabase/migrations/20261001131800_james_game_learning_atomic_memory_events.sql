-- James Game Learning Atomic Memory Events v1
-- Serialize event-keyed experience memories beyond the primary Game Brain aggregate.

create or replace function public.record_james_game_memory_event(
  p_pattern text,
  p_strategy text,
  p_event_key text,
  p_success_delta integer,
  p_failure_delta integer,
  p_capabilities jsonb,
  p_last_evidence jsonb,
  p_confidence_mode text default 'standard',
  p_confidence_override numeric default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_key text := nullif(trim(p_event_key), '');
  v_existing public.james_experiences%rowtype;
  v_success integer;
  v_failure integer;
  v_total integer;
  v_rate numeric;
  v_confidence numeric;
  v_status text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'memory|' || coalesce(p_pattern, '') || '|' || coalesce(p_strategy, ''),
      0
    )
  );

  select *
    into v_existing
    from public.james_experiences
   where user_id is null
     and pattern = p_pattern
     and strategy = p_strategy
     and status in ('active', 'blocked')
   order by created_at asc
   limit 1
   for update;

  if found and v_event_key is not null and v_existing.last_source_event_key = v_event_key then
    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'id', v_existing.id,
      'success_count', v_existing.success_count,
      'failure_count', v_existing.failure_count,
      'confidence', v_existing.confidence,
      'status', v_existing.status
    );
  end if;

  v_success := coalesce(v_existing.success_count, 0) + greatest(0, coalesce(p_success_delta, 0));
  v_failure := coalesce(v_existing.failure_count, 0) + greatest(0, coalesce(p_failure_delta, 0));
  v_total := v_success + v_failure;
  v_rate := case when v_total > 0 then v_success::numeric / v_total::numeric else 0 end;

  if p_confidence_override is not null then
    v_confidence := greatest(0.1, least(0.99, p_confidence_override));
  elsif p_confidence_mode = 'weighted-existing' then
    v_confidence := least(0.99, greatest(0.1,
      v_rate * 0.7 + coalesce(v_existing.confidence, 0.5) * 0.3
    ));
  elsif p_confidence_mode = 'contradiction' then
    v_confidence := least(0.99, greatest(0.1, 0.45 + least(0.45, v_total * 0.05)));
  else
    v_confidence := least(0.99, greatest(0.1,
      0.45 + v_rate * 0.45 + least(0.1, v_total * 0.01)
    ));
  end if;

  v_status := case
    when p_confidence_mode = 'standard' and v_rate < 0.4 and v_failure >= 3 then 'blocked'
    when v_existing.status = 'blocked' and p_confidence_mode <> 'standard' then 'blocked'
    else 'active'
  end;

  if found then
    update public.james_experiences
       set success_count = v_success,
           failure_count = v_failure,
           confidence = v_confidence,
           capabilities = case
             when jsonb_typeof(coalesce(p_capabilities, '[]'::jsonb)) = 'array'
               then p_capabilities
             else coalesce(v_existing.capabilities, '[]'::jsonb)
           end,
           status = v_status,
           last_source_event_key = coalesce(v_event_key, v_existing.last_source_event_key),
           last_evidence = coalesce(p_last_evidence, v_existing.last_evidence),
           updated_at = now()
     where id = v_existing.id;
  else
    insert into public.james_experiences (
      user_id, pattern, strategy, confidence, success_count, failure_count,
      capabilities, status, last_source_event_key, last_evidence
    ) values (
      null,
      p_pattern,
      p_strategy,
      v_confidence,
      v_success,
      v_failure,
      case
        when jsonb_typeof(coalesce(p_capabilities, '[]'::jsonb)) = 'array'
          then p_capabilities
        else '[]'::jsonb
      end,
      v_status,
      v_event_key,
      coalesce(p_last_evidence, '{}'::jsonb)
    )
    returning id into v_existing.id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'id', v_existing.id,
    'success_count', v_success,
    'failure_count', v_failure,
    'confidence', v_confidence,
    'status', v_status
  );
end;
$$;

revoke execute on function public.record_james_game_memory_event(text,text,text,integer,integer,jsonb,jsonb,text,numeric) from public, anon, authenticated;
grant execute on function public.record_james_game_memory_event(text,text,text,integer,integer,jsonb,jsonb,text,numeric) to service_role;
