-- The Laboratory stores the full lab state in fun_sessions.source.
-- Large JSON payloads can exceed PostgreSQL's btree index entry limit.
-- The source index is not required for correctness; session reads already
-- filter by session_id and source prefix and can safely use a table scan.
drop index if exists public.fun_sessions_source_idx;
