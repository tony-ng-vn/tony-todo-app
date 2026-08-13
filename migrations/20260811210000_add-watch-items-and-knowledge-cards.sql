create table if not exists public.watch_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id text,
  video_id text not null,
  url text not null,
  title text,
  channel text,
  thumbnail_url text,
  state text not null default 'awaiting_transcript'
    check (state in ('awaiting_transcript', 'captured', 'extracted', 'skipped')),
  transcript text,
  notes text,
  completed_at timestamptz,
  transcript_pasted_at timestamptz,
  brain_episode_id uuid,
  brain_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create index if not exists watch_items_user_state_idx
  on public.watch_items (user_id, state);

alter table public.watch_items enable row level security;

create policy "watch_items_select_own" on public.watch_items
  for select using (user_id = auth.uid());

create policy "watch_items_insert_own" on public.watch_items
  for insert with check (user_id = auth.uid());

create policy "watch_items_update_own" on public.watch_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watch_item_id uuid not null references public.watch_items(id) on delete cascade,
  video_id text not null,
  kind text not null check (kind in ('claim', 'technique', 'tool', 'action', 'quote')),
  body text not null,
  excerpt text,
  timecode_seconds integer,
  deep_link text,
  topics text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'kept', 'archived')),
  surfaced_count integer not null default 0,
  last_surfaced_at timestamptz,
  extractor_version text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_cards_user_watch_item_idx
  on public.knowledge_cards (user_id, watch_item_id);

alter table public.knowledge_cards enable row level security;

create policy "knowledge_cards_select_own" on public.knowledge_cards
  for select using (user_id = auth.uid());

create policy "knowledge_cards_update_own" on public.knowledge_cards
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
