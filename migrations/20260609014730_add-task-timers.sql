alter table public.todos
  add column if not exists first_started_at timestamptz,
  add column if not exists active_started_at timestamptz,
  add column if not exists tracked_seconds integer not null default 0;

create index if not exists todos_client_active_timer_idx
  on public.todos (client_id, active_started_at)
  where active_started_at is not null;
