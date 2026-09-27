-- Prevent concurrent autonomous cycles from creating duplicate active learning work.
create unique index if not exists james_improvement_goals_active_unique_idx
  on public.james_improvement_goals(user_id, target_capability)
  where status in ('proposed','queued','running');
