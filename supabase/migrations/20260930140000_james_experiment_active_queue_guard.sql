-- Prevent concurrent autonomous experiment queue entries for the same user/capability.
-- A single active experiment per capability is intentional: the sandbox feedback
-- loop must observe one causal mutation at a time rather than race its own baseline.
create unique index if not exists james_game_experiments_one_active_per_capability_idx
on public.james_game_experiments (
  coalesce(user_id, '00000000-0000-0000-0000-000000000001'),
  coalesce(capability_key, '')
)
where status in ('pending_verification', 'running');

comment on index public.james_game_experiments_one_active_per_capability_idx is
  'Prevents duplicate active James experiments for the same user/capability while allowing completed history.';