-- The existing client_id-prefixed index cannot serve lookups by parent_task_id alone.
create index if not exists todos_parent_task_id_idx
  on public.todos (parent_task_id)
  where parent_task_id is not null;
