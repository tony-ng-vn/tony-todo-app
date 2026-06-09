create table if not exists public.todos (
  id text primary key,
  client_id text not null,
  title text not null check (length(trim(title)) > 0),
  created_at timestamptz not null,
  completed_at timestamptz,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists todos_client_created_idx
  on public.todos (client_id, created_at);

create index if not exists todos_client_completed_idx
  on public.todos (client_id, completed_at)
  where completed_at is not null;

create index if not exists todos_client_open_idx
  on public.todos (client_id, created_at)
  where completed_at is null;
