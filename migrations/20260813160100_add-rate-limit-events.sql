-- Per-user fixed-window rate limiting for the LLM-calling edge functions.
-- Only the admin client touches this table (RLS on, no policies), so
-- users cannot read or reset their own counters.
create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  function_name text not null,
  called_at timestamptz not null default now()
);

create index if not exists rate_limit_events_window_idx
  on public.rate_limit_events (user_id, function_name, called_at);

alter table public.rate_limit_events enable row level security;
