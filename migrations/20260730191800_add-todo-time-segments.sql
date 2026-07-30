alter table public.todos
  add column if not exists time_segments jsonb not null default '[]'::jsonb
  check (jsonb_typeof(time_segments) = 'array');

create or replace function public.log_progress_session(
  p_parent_id text,
  p_session_id text,
  p_title text,
  p_created_at timestamptz,
  p_completed_at timestamptz,
  p_note text,
  p_first_started_at timestamptz,
  p_tracked_seconds integer,
  p_time_segments jsonb,
  p_progress_label text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.todos (
    id,
    user_id,
    title,
    created_at,
    completed_at,
    note,
    source,
    first_started_at,
    active_started_at,
    tracked_seconds,
    time_segments,
    is_progressive,
    parent_task_id,
    is_progress_session,
    progress_label
  )
  values (
    p_session_id,
    auth.uid(),
    p_title,
    p_created_at,
    p_completed_at,
    coalesce(p_note, ''),
    'progress-session',
    p_first_started_at,
    null,
    greatest(coalesce(p_tracked_seconds, 0), 0),
    coalesce(p_time_segments, '[]'::jsonb),
    false,
    p_parent_id,
    true,
    coalesce(p_progress_label, '')
  )
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.todos
    where id = p_session_id
      and user_id = auth.uid()
      and parent_task_id = p_parent_id
      and is_progress_session is true
  ) then
    raise exception 'Progress session could not be created';
  end if;

  update public.todos
  set first_started_at = null,
      active_started_at = null,
      tracked_seconds = 0,
      time_segments = '[]'::jsonb,
      progress_label = coalesce(p_progress_label, ''),
      updated_at = now()
  where id = p_parent_id
    and user_id = auth.uid()
    and completed_at is null
    and is_progressive is true;

  if not found then
    raise exception 'Progressive parent task was not found';
  end if;
end;
$$;

revoke execute on function public.log_progress_session(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  timestamptz,
  integer,
  jsonb,
  text
) from public, anon;

grant execute on function public.log_progress_session(
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  timestamptz,
  integer,
  jsonb,
  text
) to authenticated;
