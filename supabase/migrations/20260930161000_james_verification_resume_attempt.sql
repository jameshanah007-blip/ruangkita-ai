create or replace function public.claim_james_game_experiment(p_user_id text default null)
returns public.james_game_experiments
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  claimed public.james_game_experiments;
  resume_attempt boolean;
begin
  update public.james_game_experiments
  set status = case when attempt >= 5 then 'failed' else 'pending_verification' end,
      runner_token = null,
      started_at = null
  where status = 'running'
    and started_at < now() - interval '10 minutes';

  select exists (
    select 1
    from public.james_experiment_verification_ledger l
    join public.james_game_experiments e on e.id = l.experiment_id
    where e.status = 'pending_verification'
      and l.finalized = false
      and l.attempt = e.attempt
      and (p_user_id is null or e.user_id = p_user_id)
  ) into resume_attempt;

  update public.james_game_experiments
  set status = 'running',
      runner_token = encode(gen_random_bytes(18),'hex'),
      started_at = now(),
      attempt = case when resume_attempt then attempt else attempt + 1 end
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