create table if not exists public.james_meta_strategy_synthesis (
  id uuid primary key default gen_random_uuid(),
  strategy_key text unique not null,
  task_class text not null,
  strategy text not null,
  source_patterns jsonb not null default '[]'::jsonb,
  evidence_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  confidence numeric(5,4) not null default 0.5,
  status text not null default 'candidate' check (status in ('candidate','validated','deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists james_meta_strategy_synthesis_task_idx
  on public.james_meta_strategy_synthesis(task_class,status,confidence desc);

alter table public.james_meta_strategy_synthesis enable row level security;

create or replace function public.synthesize_james_meta_strategy(
  p_strategy_key text,
  p_task_class text,
  p_strategy text,
  p_source_patterns jsonb,
  p_confidence numeric default 0.5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.james_meta_strategy_synthesis(
    strategy_key,task_class,strategy,source_patterns,
    evidence_count,confidence,status,updated_at
  )
  values(
    p_strategy_key,p_task_class,p_strategy,
    coalesce(p_source_patterns,'[]'::jsonb),
    jsonb_array_length(coalesce(p_source_patterns,'[]'::jsonb)),
    greatest(0,least(1,coalesce(p_confidence,0.5))),
    'candidate',now()
  )
  on conflict(strategy_key) do update set
    strategy=excluded.strategy,
    task_class=excluded.task_class,
    source_patterns=excluded.source_patterns,
    evidence_count=excluded.evidence_count,
    confidence=greatest(0,least(1,excluded.confidence)),
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.synthesize_james_meta_strategy(text,text,text,jsonb,numeric)
from public,anon,authenticated;
grant execute on function public.synthesize_james_meta_strategy(text,text,text,jsonb,numeric)
to service_role;
