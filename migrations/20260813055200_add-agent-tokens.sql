-- Per-user agent keys for the agent-todos function. Settings stores one
-- token per signed-in user so a pasted setup does not need ownerUserId
-- and does not share INGEST_FUNCTION_TOKEN. The token is readable by
-- its owner (copy again from Settings) and looked up by the function
-- with the admin client.
create table if not exists public.agent_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique check (token ~ '^dlg_[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.agent_tokens enable row level security;

create policy "agent_tokens_select_own" on public.agent_tokens
  for select using (user_id = auth.uid());

create policy "agent_tokens_insert_own" on public.agent_tokens
  for insert with check (user_id = auth.uid());

create policy "agent_tokens_update_own" on public.agent_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "agent_tokens_delete_own" on public.agent_tokens
  for delete using (user_id = auth.uid());
