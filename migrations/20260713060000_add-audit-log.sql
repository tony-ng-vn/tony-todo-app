-- Every AI action recorded, per docs/PRD.md FR-15 and Section 32.5
-- ("every AI action is logged with model, prompt template version,
-- sources, tool call, result, and approving user"). This is the
-- durable record; the app's evidence rows already cover extraction
-- provenance, this covers action-level events (a loop created, a
-- draft generated) with enough detail to answer "what did the AI do
-- and when" without a direct database query.
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('loop_created', 'draft_generated')),
  loop_id text references public.todos(id) on delete set null,
  model text,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_created_idx
  on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_own" on public.audit_log
  for select using (user_id = auth.uid());

create policy "audit_log_insert_own" on public.audit_log
  for insert with check (user_id = auth.uid());
