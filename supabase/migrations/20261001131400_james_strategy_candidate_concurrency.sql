-- James Strategy Candidate Concurrency Guard v1
-- Prevent two autonomous workers from creating the same non-retired candidate.
create unique index if not exists james_meta_strategies_nonretired_task_strategy_uidx
  on public.james_meta_strategies(task_class, strategy)
  where status <> 'retired';

-- Atomic candidate creation helper for autonomous synthesis.
create or replace function public.create_james_meta_strategy_candidate(
  p_task_class text,
  p_strategy text,
  p_capabilities jsonb,
  p_confidence numeric
)
returns public.james_meta_strategies
language plpgsql
security definer
set search_path=public
as $$
declare v_candidate public.james_meta_strategies;
begin
  if coalesce(length(trim(p_task_class)),0)=0
     or coalesce(length(trim(p_strategy)),0)=0 then
    raise exception 'invalid_strategy_payload';
  end if;

  insert into public.james_meta_strategies(
    task_class,strategy,capabilities,evidence_count,
    success_count,failure_count,confidence,status
  )
  values(
    trim(p_task_class),
    trim(p_strategy),
    coalesce(p_capabilities,'[]'::jsonb),
    0,0,0,
    greatest(0,least(.99,coalesce(p_confidence,0))),
    'candidate'
  )
  on conflict (task_class,strategy) where status <> 'retired'
  do update set updated_at=public.james_meta_strategies.updated_at
  returning * into v_candidate;

  return v_candidate;
end;
$$;

revoke all on function public.create_james_meta_strategy_candidate(text,text,jsonb,numeric)
from public,anon,authenticated;
grant execute on function public.create_james_meta_strategy_candidate(text,text,jsonb,numeric)
to service_role;
