-- Replaces anonymous client_id scoping with real InsForge auth (auth.users).
-- client_id is kept (nullable) rather than dropped so existing anonymous rows
-- are not destroyed; the app no longer writes to it going forward.

alter table public.todos
  alter column client_id drop not null;

alter table public.todos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists todos_user_created_idx
  on public.todos (user_id, created_at);

create index if not exists todos_user_completed_idx
  on public.todos (user_id, completed_at)
  where completed_at is not null;

create index if not exists todos_user_open_idx
  on public.todos (user_id, created_at)
  where completed_at is null;

alter table public.todos enable row level security;

create policy "todos_select_own" on public.todos
  for select using (user_id = auth.uid());

create policy "todos_insert_own" on public.todos
  for insert with check (user_id = auth.uid());

create policy "todos_update_own" on public.todos
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "todos_delete_own" on public.todos
  for delete using (user_id = auth.uid());
