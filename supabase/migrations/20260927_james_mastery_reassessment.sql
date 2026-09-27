alter table public.james_self_model
  add column if not exists last_reassessed_at timestamptz,
  add column if not exists decay_score numeric not null default 0,
  add column if not exists reassessment_due_at timestamptz;

create index if not exists james_self_model_reassessment_idx
  on public.james_self_model(user_id, reassessment_due_at);
