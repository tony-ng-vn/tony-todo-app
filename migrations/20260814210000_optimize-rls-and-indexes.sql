-- Performance pass from the 2026-08-14 audit; no policy grants or behavior
-- change anywhere in this file.

-- 1) Wrap auth.uid() in an initplan subquery in every RLS policy. A bare
-- auth.uid() re-evaluates per candidate row; (select auth.uid()) runs once
-- per query. The storage policies from the task-photo migration already use
-- this form; this aligns the older table policies (20 advisor warnings).

alter policy todos_select_own on public.todos
  using (user_id = (select auth.uid()));
alter policy todos_insert_own on public.todos
  with check (user_id = (select auth.uid()));
alter policy todos_update_own on public.todos
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy todos_delete_own on public.todos
  using (user_id = (select auth.uid()));

alter policy people_all_own on public.people
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy evidence_all_own on public.evidence
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy learned_rules_all_own on public.learned_rules
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy ingestion_cursor_all_own on public.ingestion_cursor
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy oauth_connections_all_own on public.oauth_connections
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy audit_log_select_own on public.audit_log
  using (user_id = (select auth.uid()));

alter policy feedback_insert_own on public.feedback
  with check (user_id = (select auth.uid()));

alter policy watch_items_select_own on public.watch_items
  using (user_id = (select auth.uid()));
alter policy watch_items_insert_own on public.watch_items
  with check (user_id = (select auth.uid()));
alter policy watch_items_update_own on public.watch_items
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy knowledge_cards_select_own on public.knowledge_cards
  using (user_id = (select auth.uid()));
alter policy knowledge_cards_update_own on public.knowledge_cards
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy agent_tokens_select_own on public.agent_tokens
  using (user_id = (select auth.uid()));
alter policy agent_tokens_insert_own on public.agent_tokens
  with check (user_id = (select auth.uid()));
alter policy agent_tokens_update_own on public.agent_tokens
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy agent_tokens_delete_own on public.agent_tokens
  using (user_id = (select auth.uid()));

-- 2) Drop the client_id-era indexes on todos. client_id has been NULL on
-- every row written since the auth migration (2026-07-13) and no query
-- filters on it; each index still taxes every insert and timer/note update.
-- todos_client_notion_page_idx is UNIQUE, but with client_id NULL on every
-- row it enforces nothing (nulls are distinct) and no code or test assumes
-- notion_page_id uniqueness; if Notion sync returns, recreate it keyed on
-- user_id. todos_parent_task_id_idx stays: it serves the parent-task FK
-- cascade.

drop index if exists public.todos_client_created_idx;
drop index if exists public.todos_client_completed_idx;
drop index if exists public.todos_client_open_idx;
drop index if exists public.todos_client_source_idx;
drop index if exists public.todos_client_notion_page_idx;
drop index if exists public.todos_client_active_timer_idx;
drop index if exists public.todos_client_parent_task_idx;
drop index if exists public.todos_client_progressive_open_idx;

-- 3) Index the dismissed-history read (loopRemote loads it on every
-- refresh, ordered by updated_at, and dismissed rows accumulate forever).

create index if not exists todos_user_dismissed_updated_idx
  on public.todos (user_id, updated_at desc)
  where loop_status = 'dismissed';

-- 4) Cover the remaining foreign keys (advisor: missing-fk-index). The
-- mostly-NULL columns get partial indexes so they stay tiny.

create index if not exists audit_log_loop_idx
  on public.audit_log (loop_id)
  where loop_id is not null;
create index if not exists feedback_user_idx
  on public.feedback (user_id);
create index if not exists knowledge_cards_watch_item_idx
  on public.knowledge_cards (watch_item_id);
create index if not exists learned_rules_created_from_todo_idx
  on public.learned_rules (created_from_todo_id)
  where created_from_todo_id is not null;
create index if not exists todos_counterparty_person_idx
  on public.todos (counterparty_person_id)
  where counterparty_person_id is not null;
create index if not exists todos_merge_parent_idx
  on public.todos (merge_parent_id)
  where merge_parent_id is not null;
