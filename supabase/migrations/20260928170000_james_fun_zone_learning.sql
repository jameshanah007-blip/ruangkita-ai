create table if not exists public.james_fun_zone_runs (
  id uuid primary key default gen_random_uuid(),
  genre text,
  passed boolean not null,
  runtime_ok boolean,
  rendered boolean,
  loop_started boolean,
  frame_advanced boolean,
  input_test boolean,
  gameplay_test boolean,
  performance_test boolean,
  game_test_protocol boolean,
  state_changed boolean,
  objective_changed boolean,
  player_changed boolean,
  win_state_detected boolean,
  lose_state_detected boolean,
  restart_verified boolean,
  frame_count integer,
  game_animation_frames integer,
  input_events integer,
  input_listeners integer,
  elapsed_ms integer,
  hard_failure_count integer not null default 0,
  warning_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists james_fun_zone_runs_created_at_idx
  on public.james_fun_zone_runs(created_at desc);

create index if not exists james_fun_zone_runs_passed_idx
  on public.james_fun_zone_runs(passed, created_at desc);

alter table public.james_fun_zone_runs enable row level security;

drop policy if exists james_fun_zone_runs_service_role on public.james_fun_zone_runs;
create policy james_fun_zone_runs_service_role
  on public.james_fun_zone_runs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');