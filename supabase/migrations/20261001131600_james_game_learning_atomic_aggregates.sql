-- James Game Learning Atomic Aggregate Updates v1
-- Serialize duplicate Game Brain events at the database boundary.
-- No production data is modified by this migration itself.

create or replace function public.record_james_game_experience_event(
  p_pattern text,
  p_strategy text,
  p_user_id uuid,
  p_passed boolean,
  p_quality numeric,
  p_capabilities jsonb,
  p_event_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.james_experiences%rowtype;
  v_success integer;
  v_failure integer;
  v_total integer;
  v_confidence numeric;
begin
  if nullif(trim(p_event_key), '') is null then
    raise exception 'p_event_key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      coalesce(p_user_id::text, 'null') || '|' || coalesce(p_pattern, '') || '|' ||
      coalesce(p_strategy, '') || '|active',
      0
    )
  );

  select *
    into v_existing
    from public.james_experiences
   where ((user_id = p_user_id) or (user_id is null and p_user_id is null))
     and pattern = p_pattern
     and strategy = p_strategy
     and status = 'active'
   order by created_at asc
   limit 1
   for update;

  if found then
    if v_existing.last_source_event_key = p_event_key then
      return jsonb_build_object('applied', false, 'duplicate', true, 'id', v_existing.id);
    end if;

    v_success := v_existing.success_count + case when p_passed then 1 else 0 end;
    v_failure := v_existing.failure_count + case when p_passed then 0 else 1 end;
    v_total := v_success + v_failure;
    v_confidence := greatest(0.05, least(0.99,
      case when v_total > 0 then v_success::numeric / v_total::numeric else p_quality end
    ));

    update public.james_experiences
       set success_count = v_success,
           failure_count = v_failure,
           confidence = v_confidence,
           capabilities = (
             select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
               from jsonb_array_elements(
                 coalesce(v_existing.capabilities, '[]'::jsonb) ||
                 coalesce(p_capabilities, '[]'::jsonb)
               ) as elements(value)
           ),
           last_source_event_key = p_event_key,
           updated_at = now()
     where id = v_existing.id;

    return jsonb_build_object('applied', true, 'duplicate', false, 'id', v_existing.id);
  end if;

  insert into public.james_experiences (
    user_id, pattern, strategy, capabilities, success_count, failure_count,
    confidence, status, last_source_event_key
  ) values (
    p_user_id,
    p_pattern,
    p_strategy,
    coalesce(p_capabilities, '[]'::jsonb),
    case when p_passed then 1 else 0 end,
    case when p_passed then 0 else 1 end,
    greatest(0.05, least(0.99, p_quality)),
    'active',
    p_event_key
  )
  returning id into v_existing.id;

  return jsonb_build_object('applied', true, 'duplicate', false, 'id', v_existing.id);
end;
$$;

create or replace function public.record_james_game_self_model_event(
  p_user_id text,
  p_capability_key text,
  p_capability_name text,
  p_event_key text,
  p_passed boolean,
  p_quality numeric,
  p_weight numeric,
  p_attempt integer,
  p_blueprint text,
  p_diversity_count integer,
  p_transfer_tested boolean,
  p_transfer_signal integer,
  p_transfer_weight numeric,
  p_transfer_tests integer,
  p_transfer_success_rate numeric,
  p_adaptation_directive text,
  p_strategy_fingerprint text,
  p_strategy_comparison jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_model public.james_self_model%rowtype;
  v_old_evidence integer;
  v_previous_competence numeric;
  v_previous_confidence numeric;
  v_next_evidence integer;
  v_next_competence numeric;
  v_evidence_confidence numeric;
  v_diversity_confidence numeric;
  v_next_confidence numeric;
  v_success integer;
  v_failure integer;
  v_transfer_success boolean;
  v_model_found boolean := false;
  v_status text;
  v_next_learning_action text;
begin
  if nullif(trim(p_event_key), '') is null then
    raise exception 'p_event_key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(coalesce(p_user_id, '') || '|' || coalesce(p_capability_key, ''), 0)
  );

  select *
    into v_model
    from public.james_self_model
   where user_id = p_user_id
     and capability_key = p_capability_key
   limit 1
   for update;

  v_model_found := found;

  if v_model_found and v_model.last_source_event_key = p_event_key then
    return jsonb_build_object('applied', false, 'duplicate', true, 'id', v_model.id);
  end if;

  v_old_evidence := coalesce(v_model.evidence_count, 0);
  v_previous_competence := coalesce(v_model.competence, 0.5);
  v_previous_confidence := coalesce(v_model.confidence, 0.2);
  v_next_evidence := v_old_evidence + 1;

  v_next_competence := greatest(0, least(1,
    case
      when v_old_evidence = 0 then case when p_passed then 0.75 else 0.25 end
      else v_previous_competence * 0.35 + case when p_passed then 1 else 0 end * 0.65
    end
  ));

  v_evidence_confidence := least(0.95, 0.2 + log(2, v_next_evidence + 1) * 0.18);
  v_diversity_confidence := least(1, greatest(0, p_diversity_count)::numeric / 4);
  v_next_confidence := greatest(0.1, least(0.99,
    v_evidence_confidence * 0.5 +
    v_previous_confidence * 0.25 +
    v_diversity_confidence * 0.25
  ));

  v_success := coalesce(v_model.success_count, 0) + case when p_passed then 1 else 0 end;
  v_failure := coalesce(v_model.failure_count, 0) + case when p_passed then 0 else 1 end;
  v_transfer_success := p_transfer_tests >= 3 and coalesce(p_transfer_success_rate, 0) >= 0.75;

  v_status := case
    when v_next_evidence >= 12 and p_diversity_count >= 3 and v_next_competence >= 0.85 and v_transfer_success then 'strong'
    when v_next_evidence >= 5 and p_diversity_count >= 2 and v_next_competence >= 0.70 then 'competent'
    when v_next_evidence < 2 then 'unknown'
    else 'developing'
  end;

  v_next_learning_action := case v_status
    when 'strong' then 'monitor-and-verify'
    when 'competent' then 'increase-diversity-and-test'
    else 'improve-and-retest'
  end;

  insert into public.james_capability_mastery_history (
    user_id, source_event_key, capability_key,
    previous_competence, competence,
    previous_confidence, confidence,
    evidence_count, outcome, source, evidence
  ) values (
    'system:fun-zone',
    p_event_key || ':' || p_capability_key,
    p_capability_key,
    v_previous_competence,
    v_next_competence,
    v_previous_confidence,
    v_next_confidence,
    v_next_evidence,
    case when p_passed then 'success' else 'failure' end,
    'fun-zone',
    jsonb_build_object(
      'attempt', p_attempt,
      'quality', p_quality,
      'weight', p_weight,
      'blueprint', p_blueprint,
      'diversity_count', p_diversity_count,
      'transfer_tested', p_transfer_tested,
      'transfer_signal', p_transfer_signal,
      'transfer_weight', p_transfer_weight,
      'transfer_tests', p_transfer_tests,
      'transfer_success_rate', p_transfer_success_rate,
      'adaptation_directive', p_adaptation_directive,
      'strategy_fingerprint', p_strategy_fingerprint,
      'strategy_comparison', coalesce(p_strategy_comparison, '{}'::jsonb)
    )
  )
  on conflict (source_event_key) do nothing;

  if not v_model_found then
    insert into public.james_self_model (
      user_id, capability_key, capability_name, competence, confidence,
      evidence_count, success_count, failure_count, teacher_providers,
      active_models, last_evidence, next_learning_action, status,
      last_source_event_key
    ) values (
      p_user_id, p_capability_key, p_capability_name,
      v_next_competence, v_next_confidence, v_next_evidence,
      v_success, v_failure, '["james-autonomous"]'::jsonb,
      '["game-brain-v2"]'::jsonb,
      jsonb_build_object('source','fun-zone','attempt',p_attempt,'passed',p_passed,
        'quality',p_quality,'weight',p_weight,'blueprint',p_blueprint,
        'diversity_count',p_diversity_count,'transfer_tested',p_transfer_tested,
        'transfer_signal',p_transfer_signal,'transfer_weight',p_transfer_weight,
        'transfer_tests',p_transfer_tests,'transfer_success_rate',p_transfer_success_rate,
        'adaptation_directive',p_adaptation_directive),
      v_next_learning_action, v_status, p_event_key
    )
    on conflict (user_id, capability_key) do update
      set competence = excluded.competence,
          confidence = excluded.confidence,
          evidence_count = excluded.evidence_count,
          success_count = excluded.success_count,
          failure_count = excluded.failure_count,
          last_evidence = excluded.last_evidence,
          next_learning_action = excluded.next_learning_action,
          status = excluded.status,
          last_source_event_key = excluded.last_source_event_key,
          updated_at = now();
  else
    update public.james_self_model
       set capability_name = p_capability_name,
           competence = v_next_competence,
           confidence = v_next_confidence,
           evidence_count = v_next_evidence,
           success_count = v_success,
           failure_count = v_failure,
           teacher_providers = '["james-autonomous"]'::jsonb,
           active_models = '["game-brain-v2"]'::jsonb,
           last_evidence = jsonb_build_object(
             'source','fun-zone','attempt',p_attempt,'passed',p_passed,
             'quality',p_quality,'weight',p_weight,'blueprint',p_blueprint,
             'diversity_count',p_diversity_count,'transfer_tested',p_transfer_tested,
             'transfer_signal',p_transfer_signal,'transfer_weight',p_transfer_weight,
             'transfer_tests',p_transfer_tests,'transfer_success_rate',p_transfer_success_rate,
             'adaptation_directive',p_adaptation_directive
           ),
           next_learning_action = v_next_learning_action,
           status = v_status,
           last_source_event_key = p_event_key,
           updated_at = now()
     where id = v_model.id;
  end if;

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke execute on function public.record_james_game_experience_event(text,text,uuid,boolean,numeric,jsonb,text) from public, anon, authenticated;
revoke execute on function public.record_james_game_self_model_event(text,text,text,text,boolean,numeric,numeric,integer,text,integer,boolean,integer,numeric,integer,numeric,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_james_game_experience_event(text,text,uuid,boolean,numeric,jsonb,text) to service_role;
grant execute on function public.record_james_game_self_model_event(text,text,text,text,boolean,numeric,numeric,integer,text,integer,boolean,integer,numeric,integer,numeric,text,text,jsonb) to service_role;

