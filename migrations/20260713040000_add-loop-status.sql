-- Persists the confidence-based routing decision from PRD.md Section 7
-- ("0.85+ goes straight to Focus, 0.60-0.84 goes to Inbox") so the app can
-- filter by it. Existing/manual rows default to 'accepted' since they were
-- never subject to review in the first place.
alter table public.todos
  add column if not exists loop_status text
    check (loop_status in ('inbox', 'accepted', 'dismissed'))
    default 'accepted';

create index if not exists todos_user_loop_status_idx
  on public.todos (user_id, loop_status)
  where loop_status = 'inbox';
