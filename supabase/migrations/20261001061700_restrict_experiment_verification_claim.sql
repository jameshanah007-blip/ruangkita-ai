-- Keep the verification-claim RPC server-only. The route already authenticates
-- with the cron secret, so browser-facing roles do not need EXECUTE.
revoke execute on function public.claim_james_game_experiment_verification(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.claim_james_game_experiment_verification(uuid, integer, text) to service_role;
