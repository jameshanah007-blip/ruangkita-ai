create index if not exists james_meta_strategies_status_updated_idx
  on public.james_meta_strategies(status, updated_at desc);