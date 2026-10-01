-- Server-owned strategy state lockdown v3
-- All James strategy tables are server-owned and must not be writable by
-- anon/authenticated clients. service_role is the only direct table writer.

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and c.relname like 'james_meta_strategy%'
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', r.relname);
    execute format('grant select, insert, update, delete on table public.%I to service_role', r.relname);
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end $$;
