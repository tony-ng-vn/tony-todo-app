alter table public.todos
  add column if not exists is_progressive boolean not null default false,
  add column if not exists parent_task_id text references public.todos(id) on delete cascade,
  add column if not exists is_progress_session boolean not null default false,
  add column if not exists progress_label text not null default '';

create index if not exists todos_client_parent_task_idx
  on public.todos (client_id, parent_task_id)
  where parent_task_id is not null;

create index if not exists todos_client_progressive_open_idx
  on public.todos (client_id, created_at)
  where completed_at is null and is_progressive is true;
