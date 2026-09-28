-- James Feedback Loop
-- Explicit user feedback is evidence for future reflection, not an automatic character rewrite.

create table if not exists public.james_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id uuid not null,
  user_message text not null default '',
  assistant_message text not null default '',
  rating text not null check (rating in ('helpful', 'not_helpful')),
  feedback text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists james_feedback_user_created_idx
  on public.james_feedback(user_id, created_at desc);

create index if not exists james_feedback_conversation_idx
  on public.james_feedback(conversation_id, created_at desc);

alter table public.james_feedback enable row level security;
revoke all on table public.james_feedback from anon, authenticated;
grant all on table public.james_feedback to service_role;

comment on table public.james_feedback is
  'Explicit user feedback used as evidence for James reflection and bounded evolution.';
