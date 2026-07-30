alter table public.todos
  add column if not exists time_segments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(time_segments) = 'array');
