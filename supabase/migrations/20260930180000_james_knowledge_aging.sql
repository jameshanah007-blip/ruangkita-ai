alter table public.james_experience_consolidations
  add column if not exists last_validated_at timestamptz,
  add column if not exists stale_after_days integer not null default 90;

alter table public.james_experiences
  add column if not exists last_validated_at timestamptz,
  add column if not exists stale_after_days integer not null default 90;

create index if not exists james_consolidations_validation_idx
  on public.james_experience_consolidations(last_validated_at);

create index if not exists james_experiences_validation_idx
  on public.james_experiences(last_validated_at);

create or replace function public.get_james_knowledge_freshness(
  p_knowledge_id uuid,
  p_knowledge_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_validated timestamptz;
  v_created timestamptz;
  v_stale_days integer;
  v_age_days numeric;
  v_stale boolean;
begin
  if p_knowledge_source = 'consolidation' then
    select coalesce(last_validated_at, created_at), created_at, stale_after_days
      into v_validated, v_created, v_stale_days
    from public.james_experience_consolidations where id = p_knowledge_id;
  elsif p_knowledge_source = 'experience' then
    select coalesce(last_validated_at, created_at), created_at, stale_after_days
      into v_validated, v_created, v_stale_days
    from public.james_experiences where id = p_knowledge_id;
  else
    raise exception 'unsupported knowledge source';
  end if;

  if v_validated is null then return null; end if;

  v_age_days := extract(epoch from (now() - v_validated)) / 86400.0;
  v_stale := v_age_days >= greatest(1, v_stale_days);

  return jsonb_build_object(
    'validatedAt', v_validated,
    'createdAt', v_created,
    'ageDays', round(v_age_days, 2),
    'staleAfterDays', v_stale_days,
    'stale', v_stale
  );
end;
$$;

revoke all on function public.get_james_knowledge_freshness(uuid,text) from public, anon, authenticated;
grant execute on function public.get_james_knowledge_freshness(uuid,text) to service_role;
