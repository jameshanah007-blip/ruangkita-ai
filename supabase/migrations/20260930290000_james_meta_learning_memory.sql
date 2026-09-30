create table if not exists public.james_meta_learning_memory (
  pattern_key text primary key,
  attribution text not null check (attribution in ('knowledge','retrieval','decision_policy','mixed','insufficient_evidence')),
  occurrence_count integer not null default 0,
  avg_confidence numeric(5,4) not null default 0.5,
  successful_recovery_count integer not null default 0,
  failed_recovery_count integer not null default 0,
  recommended_recovery text,
  confidence numeric(5,4) not null default 0.5,
  last_observed_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.james_meta_learning_memory enable row level security;

create or replace function public.consolidate_james_meta_learning_memory(
  p_pattern_key text,
  p_attribution text,
  p_recovery text,
  p_recovery_success boolean,
  p_confidence numeric default 0.5,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occ integer;
  v_success integer;
  v_failed integer;
  v_avg numeric;
  v_conf numeric;
begin
  if p_attribution not in ('knowledge','retrieval','decision_policy','mixed','insufficient_evidence') then
    raise exception 'invalid meta-learning attribution';
  end if;

  select occurrence_count,successful_recovery_count,failed_recovery_count,avg_confidence
    into v_occ,v_success,v_failed,v_avg
  from public.james_meta_learning_memory
  where pattern_key=p_pattern_key
  for update;

  v_occ := coalesce(v_occ,0)+1;
  v_success := coalesce(v_success,0)+case when p_recovery_success then 1 else 0 end;
  v_failed := coalesce(v_failed,0)+case when p_recovery_success then 0 else 1 end;
  v_avg := ((coalesce(v_avg,0.5)*(v_occ-1))+greatest(0,least(1,coalesce(p_confidence,0.5))))/v_occ;
  v_conf := greatest(0,least(1,
    0.5 + greatest(-0.2,least(0.2,(v_success-v_failed)::numeric/greatest(1,v_occ)*0.4))
  ));

  insert into public.james_meta_learning_memory(
    pattern_key,attribution,occurrence_count,avg_confidence,
    successful_recovery_count,failed_recovery_count,
    recommended_recovery,confidence,last_observed_at,evidence,updated_at
  )
  values(
    p_pattern_key,p_attribution,v_occ,v_avg,v_success,v_failed,
    p_recovery,v_conf,now(),coalesce(p_evidence,'{}'::jsonb),now()
  )
  on conflict(pattern_key) do update set
    attribution=excluded.attribution,
    occurrence_count=excluded.occurrence_count,
    avg_confidence=excluded.avg_confidence,
    successful_recovery_count=excluded.successful_recovery_count,
    failed_recovery_count=excluded.failed_recovery_count,
    recommended_recovery=excluded.recommended_recovery,
    confidence=excluded.confidence,
    last_observed_at=excluded.last_observed_at,
    evidence=excluded.evidence,
    updated_at=excluded.updated_at;

  return jsonb_build_object(
    'patternKey',p_pattern_key,
    'occurrences',v_occ,
    'confidence',v_conf,
    'recommendedRecovery',p_recovery
  );
end;
$$;

revoke all on function public.consolidate_james_meta_learning_memory(text,text,text,boolean,numeric,jsonb)
from public,anon,authenticated;
grant execute on function public.consolidate_james_meta_learning_memory(text,text,text,boolean,numeric,jsonb)
to service_role;
