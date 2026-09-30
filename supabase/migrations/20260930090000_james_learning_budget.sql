create table if not exists public.james_learning_budget (
  budget_date date primary key default current_date,
  max_calls integer not null default 10,
  used_calls integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.james_learning_budget enable row level security;

create or replace function public.reserve_james_learning_budget(
  p_calls integer,
  p_max_calls integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := current_date;
  v_used integer;
  v_limit integer := greatest(1, p_max_calls);
begin
  if p_calls <= 0 then
    return true;
  end if;

  insert into public.james_learning_budget (budget_date, max_calls, used_calls, updated_at)
  values (v_date, v_limit, 0, now())
  on conflict (budget_date) do nothing;

  select used_calls into v_used
  from public.james_learning_budget
  where budget_date = v_date
  for update;

  if v_used + p_calls > v_limit then
    return false;
  end if;

  update public.james_learning_budget
  set used_calls = used_calls + p_calls,
      max_calls = v_limit,
      updated_at = now()
  where budget_date = v_date;

  return true;
end;
$$;

revoke all on function public.reserve_james_learning_budget(integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_james_learning_budget(integer, integer) to service_role;
