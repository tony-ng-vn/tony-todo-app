-- Someday keeps an unfinished task available while removing it from active work.
-- The timestamp records when the task was intentionally parked and remains nullable for active tasks.
alter table public.todos
  add column if not exists someday_at timestamptz;
