-- Repair the autonomous-goal claim RPC if production schema cache/function state drifted.
create or replace function public.claim_james_autonomous_goal()
returns setof public.james_autonomous_goals
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.james_autonomous_goals;
begin
  perform pg_advisory_xact_lock(hashtext('james-autonomous-goal-claim'));

  update public.james_autonomous_goals
  set
    status = 'running',
    last_run_at = now(),
    attempts = attempts + 1,
    last_error = null
  where id = (
    select id
    from public.james_autonomous_goals
    where status = 'pending'
      and next_run_at <= now()
    order by priority desc, next_run_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  if found then
    return next claimed;
  end if;

  insert into public.james_autonomous_goals (
    user_id, conversation_id, title, goal, priority, max_cycles, next_run_at
  )
  values (
    'system',
    'system-autonomous',
    'Autonomous learning cycle',
    'Pelajari satu capability yang paling membutuhkan peningkatan berdasarkan self-model James. Bandingkan hasil provider, verifikasi evidence, simpan pembelajaran tervalidasi, lalu tentukan langkah belajar berikutnya. Jangan mengubah production code atau konfigurasi deployment.',
    100, 2, now()
  )
  returning * into claimed;

  update public.james_autonomous_goals
  set status = 'running', last_run_at = now(), attempts = attempts + 1, last_error = null
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke all on function public.claim_james_autonomous_goal() from public;
revoke all on function public.claim_james_autonomous_goal() from anon;
revoke all on function public.claim_james_autonomous_goal() from authenticated;
grant execute on function public.claim_james_autonomous_goal() to service_role;
