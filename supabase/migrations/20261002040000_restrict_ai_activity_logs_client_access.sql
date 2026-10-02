-- Keep AI activity logs backend-only. The application accesses this table through SUPABASE_SECRET_KEY.
drop policy if exists "Public can view AI activity logs" on public.ai_activity_logs;
drop policy if exists "Public can insert AI activity logs" on public.ai_activity_logs;
revoke all on table public.ai_activity_logs from anon;
revoke all on table public.ai_activity_logs from authenticated;
