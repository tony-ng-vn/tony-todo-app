-- Optional due date for a task. Nullable: existing tasks and quick-adds have
-- no deadline. Users set it when creating a task or later from the detail sheet.
alter table public.todos
  add column if not exists due_date timestamptz;
