alter table public.fun_sessions
  add column if not exists game_html_path text;

insert into storage.buckets (id, name, public)
values ('fun-zone-games', 'fun-zone-games', false)
on conflict (id) do nothing;
