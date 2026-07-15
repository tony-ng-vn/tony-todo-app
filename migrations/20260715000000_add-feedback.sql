-- In-app feedback / idea capture. Any signed-in user can submit feedback
-- from the app; only the owner (via an owner-gated edge function using the
-- admin client) can read the full list. Regular users get no SELECT policy
-- here on purpose -- the triage dashboard is owner + agent only.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category text not null default 'idea' check (category in ('idea', 'bug', 'other')),
  message text not null,
  page_context text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_status_created_idx
  on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- Signed-in users may only insert rows owned by themselves.
create policy "feedback_insert_own" on public.feedback
  for insert with check (user_id = auth.uid());
