create table if not exists public.james_learning_queue (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  priority numeric(5,4) not null default 0.5 check (priority >= 0 and priority <= 1),
  task_type text not null default 'learning' check (task_type in ('learning','verification','experiment')),
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending','running','completed','failed','rejected')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  claim_token uuid,
  last_error text,
  evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_learning_queue_pending_idx
  on public.james_learning_queue(status, priority desc, created_at asc);

alter table public.james_learning_queue enable row level security;

create or replace function public.claim_james_learning_queue_item(
  p_claim_token uuid
)
returns setof public.james_learning_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.james_learning_queue q
  set status = 'running',
      attempts = q.attempts + 1,
      claimed_at = now(),
      claim_token = p_claim_token,
      updated_at = now()
  where q.id = (
    select id
    from public.james_learning_queue
    where status = 'pending'
       or (status = 'running' and claimed_at < now() - interval '30 minutes')
    order by priority desc, created_at asc
    for update skip locked
    limit 1
  )
  returning q.*;
end;
$$;

revoke all on function public.claim_james_learning_queue_item(uuid) from public, anon, authenticated;
grant execute on function public.claim_james_learning_queue_item(uuid) to service_role;
