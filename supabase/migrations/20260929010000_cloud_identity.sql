-- Cloud identity bridge for RuangKita.
-- Existing legacy user IDs remain unchanged so current James memory/conversations are preserved.
create table if not exists public.james_user_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  legacy_user_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_user_identities_legacy_idx
  on public.james_user_identities(legacy_user_id);

alter table public.james_user_identities enable row level security;
revoke all on table public.james_user_identities from anon, authenticated;
grant all on table public.james_user_identities to service_role;

comment on table public.james_user_identities is
  'Maps Supabase Auth identities to RuangKita legacy user IDs so existing cloud memory and conversations survive account migration.';
