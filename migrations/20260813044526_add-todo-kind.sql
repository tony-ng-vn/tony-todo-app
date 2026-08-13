-- Projects are captured ideas that live beside tasks in the same todos table.
-- kind is task or project so a row cannot be both a stalled task and a project idea.
alter table public.todos
  add column if not exists kind text not null default 'task';

alter table public.todos
  drop constraint if exists todos_kind_check;

alter table public.todos
  add constraint todos_kind_check check (kind in ('task', 'project'));
