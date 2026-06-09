alter table public.todos
  add column if not exists note text not null default '',
  add column if not exists source text not null default 'app',
  add column if not exists notion_page_id text,
  add column if not exists notion_database_id text,
  add column if not exists notion_status text,
  add column if not exists last_synced_at timestamptz;

create index if not exists todos_client_source_idx
  on public.todos (client_id, source);

create unique index if not exists todos_client_notion_page_idx
  on public.todos (client_id, notion_page_id)
  where notion_page_id is not null;
