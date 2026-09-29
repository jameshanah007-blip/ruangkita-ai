revoke execute on function public.claim_james_game_experiment(text) from public;
revoke execute on function public.claim_james_game_experiment(text) from anon, authenticated;
grant execute on function public.claim_james_game_experiment(text) to service_role;
