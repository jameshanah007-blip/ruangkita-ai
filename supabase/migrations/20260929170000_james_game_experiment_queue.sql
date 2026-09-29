alter table public.james_game_experiments
  drop constraint if exists james_game_experiments_status_check;

alter table public.james_game_experiments
  add constraint james_game_experiments_status_check
  check (status in ('planned','generated','pending_verification','running','verified','failed'));

alter table public.james_game_experiments
  add column if not exists runner_token text,
  add column if not exists started_at timestamptz;

create index if not exists james_game_experiments_runner_idx
  on public.james_game_experiments(status, started_at);

create or replace function public.claim_james_game_experiment(
  p_user_id text default null
)
returns public.james_game_experiments
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.james_game_experiments;
begin
  update public.james_game_experiments
  set status = 'running',
      runner_token = encode(gen_random_bytes(18), 'hex'),
      started_at = now()
  where id = (
    select id
    from public.james_game_experiments
    where status = 'pending_verification'
      and (p_user_id is null or user_id = p_user_id)
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;
