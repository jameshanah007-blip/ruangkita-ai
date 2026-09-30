create table if not exists public.james_knowledge_conflict_resolution_history (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null,
  winning_source text check (winning_source in ('candidate_a','candidate_b','none')),
  outcome text not null check (outcome in ('resolved','unresolved','verification_failed')),
  winner_confidence numeric(5,4),
  loser_confidence numeric(5,4),
  resolution_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists james_conflict_resolution_history_idx
  on public.james_knowledge_conflict_resolution_history(conflict_id,created_at desc);

alter table public.james_knowledge_conflict_resolution_history enable row level security;

create or replace function public.apply_james_conflict_resolution(
  p_conflict_id uuid,
  p_winner text,
  p_outcome text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_a numeric;
  v_b numeric;
  v_loser text;
begin
  if p_winner not in ('candidate_a','candidate_b','none') then
    raise exception 'invalid conflict winner';
  end if;
  if p_outcome not in ('resolved','unresolved','verification_failed') then
    raise exception 'invalid conflict outcome';
  end if;

  select * into c
  from public.james_knowledge_decision_conflicts
  where id=p_conflict_id
  for update;

  if c.id is null then
    return jsonb_build_object('updated',false,'reason','conflict_not_found');
  end if;

  v_loser := case
    when p_winner='candidate_a' then 'candidate_b'
    when p_winner='candidate_b' then 'candidate_a'
    else 'none'
  end;

  if p_outcome='resolved' and p_winner in ('candidate_a','candidate_b') then
    if p_winner='candidate_a' then
      v_a := greatest(0,least(1,c.score_a + 0.05));
      v_b := greatest(0,least(1,c.score_b - 0.05));
    else
      v_a := greatest(0,least(1,c.score_a - 0.05));
      v_b := greatest(0,least(1,c.score_b + 0.05));
    end if;
  else
    v_a := c.score_a;
    v_b := c.score_b;
  end if;

  update public.james_knowledge_decision_conflicts
  set decision = case
    when p_outcome='resolved' then p_winner
    when p_outcome='verification_failed' then 'verify'
    else 'unresolved'
  end,
  reason = coalesce(reason,'') || ' | Resolution: ' || p_outcome,
  resolved_at = case when p_outcome='resolved' then now() else null end
  where id=p_conflict_id;

  insert into public.james_knowledge_conflict_resolution_history
    (conflict_id,winning_source,outcome,winner_confidence,loser_confidence,resolution_evidence)
  values
    (p_conflict_id,p_winner,p_outcome,
     case when p_winner='candidate_a' then v_a when p_winner='candidate_b' then v_b else null end,
     case when v_loser='candidate_a' then v_a when v_loser='candidate_b' then v_b else null end,
     coalesce(p_evidence,'{}'::jsonb));

  return jsonb_build_object(
    'updated',true,'conflictId',p_conflict_id,'winner',p_winner,
    'outcome',p_outcome,'scoreA',v_a,'scoreB',v_b
  );
end;
$$;

revoke all on function public.apply_james_conflict_resolution(uuid,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.apply_james_conflict_resolution(uuid,text,text,jsonb)
to service_role;
