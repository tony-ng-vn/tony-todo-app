-- Tracks the last successfully processed note per user+source so the
-- ingestion function only fetches new Granola notes each run, instead of
-- re-scanning full history every invocation.
create table if not exists public.ingestion_cursor (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('granola-personal', 'granola-workspace')),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);

alter table public.ingestion_cursor enable row level security;

create policy "ingestion_cursor_all_own" on public.ingestion_cursor
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
