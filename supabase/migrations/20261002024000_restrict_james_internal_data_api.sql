-- Internal James learning, autonomy, experiment, and provider state is server-owned.
-- Keep RLS enabled, but remove direct Data API table grants from client roles.
-- The backend uses the service_role key and therefore retains access.

revoke all on table public.james_agent_tasks from anon, authenticated;
revoke all on table public.james_autonomous_brain_state from anon, authenticated;
revoke all on table public.james_autonomous_goals from anon, authenticated;
revoke all on table public.james_capability_mastery_history from anon, authenticated;
revoke all on table public.james_decision_memory from anon, authenticated;
revoke all on table public.james_experience_consolidations from anon, authenticated;
revoke all on table public.james_experiences from anon, authenticated;
revoke all on table public.james_game_experiments from anon, authenticated;
revoke all on table public.james_improvement_goals from anon, authenticated;
revoke all on table public.james_policy_critiques from anon, authenticated;
revoke all on table public.james_provider_performance from anon, authenticated;
revoke all on table public.james_self_evaluations from anon, authenticated;
revoke all on table public.james_self_model from anon, authenticated;
