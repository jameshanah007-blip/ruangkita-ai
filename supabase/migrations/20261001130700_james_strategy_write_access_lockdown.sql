-- Strategy write-access lockdown v1
-- Canonical strategy state and mutation audit are server-owned.
-- Client roles must not write directly; service_role is the only writer.
revoke all on table public.james_meta_strategies from public, anon, authenticated;
revoke all on table public.james_meta_strategy_mutation_events from public, anon, authenticated;

grant select, insert, update, delete on table public.james_meta_strategies to service_role;
grant select, insert, update, delete on table public.james_meta_strategy_mutation_events to service_role;

alter table public.james_meta_strategies enable row level security;
alter table public.james_meta_strategy_mutation_events enable row level security;
