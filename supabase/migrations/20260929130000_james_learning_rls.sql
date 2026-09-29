-- James learning data is server-side state.
-- All application access uses the Supabase service-role/secret key.
-- Enable RLS so PostgREST/browser clients cannot read or mutate these
-- internal learning tables unless an explicit policy is added later.

alter table if exists public.james_self_evaluations enable row level security;
alter table if exists public.james_provider_performance enable row level security;
alter table if exists public.james_decision_memory enable row level security;
alter table if exists public.james_experiences enable row level security;
alter table if exists public.james_experience_consolidations enable row level security;
alter table if exists public.james_policy_critiques enable row level security;
alter table if exists public.james_meta_strategies enable row level security;

-- Deliberately create no public/anon policies.
-- The server-side secret key bypasses RLS for James's internal workers.
