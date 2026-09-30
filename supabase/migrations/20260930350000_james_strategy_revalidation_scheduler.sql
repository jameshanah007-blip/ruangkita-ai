create table if not exists public.james_meta_strategy_revalidation_queue (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null,
  reason text not null,
  priority numeric(5,4) not null default 0.7,
  status text not null default 'pending' check (status in ('pending','running','completed','cancelled')),
  scheduled_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_revalidation_queue_idx
on public.james_meta_strategy_revalidation_queue(status,priority desc,scheduled_at);

alter table public.james_meta_strategy_revalidation_queue enable row level security;

create or replace function public.enqueue_james_meta_strategy_revalidation(
  p_limit integer default 10,
  p_stale_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  insert into public.james_meta_strategy_revalidation_queue(strategy_id,reason,priority)
  select m.id,
    case
      when exists (
        select 1 from public.james_meta_strategy_trials tr
        where tr.strategy_id=m.id
          and tr.outcome='failure'
          and tr.created_at > now()-interval '14 days'
      ) then 'recent_regression'
      else 'stale_validation'
    end,
    case
      when exists (
        select 1 from public.james_meta_strategy_trials tr
        where tr.strategy_id=m.id
          and tr.outcome='failure'
          and tr.created_at > now()-interval '14 days'
      ) then 0.95 else 0.65 end
  from public.james_meta_strategy_synthesis m
  where m.status in ('validated','candidate')
    and (
      m.updated_at < now() - make_interval(days=>greatest(1,p_stale_days))
      or exists (
        select 1 from public.james_meta_strategy_trials tr
        where tr.strategy_id=m.id
          and tr.outcome='failure'
          and tr.created_at > now()-interval '14 days'
      )
    )
    and not exists (
      select 1 from public.james_meta_strategy_revalidation_queue q
      where q.strategy_id=m.id and q.status in ('pending','running')
    )
  order by priority desc, m.updated_at asc
  limit greatest(1,least(50,p_limit));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_james_meta_strategy_revalidation(integer,integer)
from public,anon,authenticated;
grant execute on function public.enqueue_james_meta_strategy_revalidation(integer,integer)
to service_role;