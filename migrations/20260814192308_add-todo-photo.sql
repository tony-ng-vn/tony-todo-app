-- One optional photo per task. The URL is for display; the key is required
-- to replace or delete the object in InsForge Storage.
alter table public.todos
  add column if not exists photo_url text,
  add column if not exists photo_key text;

alter table storage.objects enable row level security;

grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

drop policy if exists task_photos_select on storage.objects;
drop policy if exists task_photos_insert on storage.objects;
drop policy if exists task_photos_update on storage.objects;
drop policy if exists task_photos_delete on storage.objects;

create policy task_photos_select on storage.objects
  for select to authenticated
  using (
    bucket = 'task-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

create policy task_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket = 'task-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

create policy task_photos_update on storage.objects
  for update to authenticated
  using (
    bucket = 'task-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  )
  with check (
    bucket = 'task-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

create policy task_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket = 'task-photos'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );
