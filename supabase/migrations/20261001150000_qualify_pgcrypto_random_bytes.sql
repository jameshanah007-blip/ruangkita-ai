-- Production compatibility: pgcrypto is installed in the extensions schema on Supabase.
-- Keep the search_path hardening while explicitly qualifying gen_random_bytes.

create or replace function public.claim_james_game_experiment(p_user_id text default null)
returns public.james_game_experiments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare claimed public.james_game_experiments;
begin
  update public.james_game_experiments
  set status = case when attempt >= 5 then 'failed' else 'pending_verification' end,
      runner_token = null,
      started_at = null
  where status = 'running'
    and started_at < now() - interval '10 minutes';

  update public.james_game_experiments
  set status = 'running',
      runner_token = encode(extensions.gen_random_bytes(18),'hex'),
      started_at = now(),
      attempt = case
        when exists (
          select 1 from public.james_experiment_verification_ledger l
          where l.experiment_id = public.james_game_experiments.id
            and l.finalized = false
            and l.attempt = public.james_game_experiments.attempt
        ) then attempt
        else attempt + 1
      end
  where id = (
    select id
    from public.james_game_experiments
    where status = 'pending_verification'
      and attempt < 5
      and (p_user_id is null or user_id = p_user_id)
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;
  return claimed;
end;
$function$;

create or replace function public.claim_james_game_experiment_verification(p_experiment_id uuid, p_attempt integer, p_runner_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare processing_token text;
begin
  processing_token := encode(extensions.gen_random_bytes(18), 'hex');

  update public.james_game_experiments
  set runner_token = processing_token,
      started_at = now()
  where id = p_experiment_id
    and status = 'running'
    and attempt = p_attempt
    and runner_token = p_runner_token;

  if not found then
    return null;
  end if;

  return processing_token;
end;
$function$;
