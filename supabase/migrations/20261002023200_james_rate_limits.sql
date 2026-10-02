create table if not exists public.james_rate_limits (
  user_id uuid primary key,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.james_rate_limits enable row level security;

revoke all on public.james_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.james_rate_limits to service_role;

create or replace function public.consume_james_rate_limit(
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_user_id is null or p_limit < 1 or p_window_seconds < 1 then
    return query select false, 0, p_window_seconds;
    return;
  end if;

  select window_start, request_count
    into v_window_start, v_count
    from public.james_rate_limits
   where user_id = p_user_id
   for update;

  if not found or v_window_start <= v_now - make_interval(secs => p_window_seconds) then
    insert into public.james_rate_limits(user_id, window_start, request_count, updated_at)
    values (p_user_id, v_now, 1, v_now)
    on conflict (user_id) do update
      set window_start = excluded.window_start,
          request_count = 1,
          updated_at = excluded.updated_at;
    return query select true, greatest(p_limit - 1, 0), 0;
    return;
  end if;

  if v_count >= p_limit then
    return query
      select false,
             0,
             greatest(
               1,
               ceil(
                 extract(
                   epoch from (
                     (v_window_start + make_interval(secs => p_window_seconds)) - v_now
                   )
                 )
               )::integer
             );
    return;
  end if;

  update public.james_rate_limits
     set request_count = v_count + 1,
         updated_at = v_now
   where user_id = p_user_id;

  return query select true, greatest(p_limit - v_count - 1, 0), 0;
end;
$$;

revoke execute on function public.consume_james_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_james_rate_limit(uuid, integer, integer)
  to service_role;
