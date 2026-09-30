create or replace function public.retrieve_james_validated_meta_strategies(
  p_task_class text,
  p_limit integer default 5
)
returns table(
  strategy_id uuid,
  strategy text,
  confidence numeric,
  evidence_count integer,
  success_count integer,
  failure_count integer,
  relevance_score numeric
)
language sql
security definer
set search_path = public
as $$
  select
    m.id,
    m.strategy,
    m.confidence,
    m.evidence_count,
    m.success_count,
    m.failure_count,
    (
      greatest(0, least(1, m.confidence)) * 0.45 +
      case
        when (m.success_count + m.failure_count) > 0
          then m.success_count::numeric / (m.success_count + m.failure_count)
        else 0.5
      end * 0.35 +
      least(1, m.evidence_count::numeric / 10) * 0.20
    )::numeric as relevance_score
  from public.james_meta_strategy_synthesis m
  where m.status = 'validated'
    and (p_task_class is null or m.task_class = p_task_class)
  order by relevance_score desc, m.updated_at desc
  limit greatest(1, least(20, p_limit));
$$;

revoke all on function public.retrieve_james_validated_meta_strategies(text, integer)
from public, anon, authenticated;

grant execute on function public.retrieve_james_validated_meta_strategies(text, integer)
to service_role;
