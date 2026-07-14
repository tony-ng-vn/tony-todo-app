-- Schema foundation for the open-loop model in docs/PRD.md (Section 6).
-- These columns and tables are not yet populated by the app: the ingestion
-- and extraction pipeline that fills them lands in a later phase. Adding
-- them now so the live schema and the PRD's domain model stay in sync.

alter table public.todos
  add column if not exists loop_type text
    check (loop_type in ('manual', 'promise', 'request', 'waiting', 'approval', 'decision', 'follow-up', 'meeting-prep'))
    default 'manual',
  add column if not exists confidence numeric check (confidence >= 0 and confidence <= 1),
  add column if not exists priority_label text check (priority_label in ('P0', 'P1', 'P2', 'P3')),
  add column if not exists priority_score numeric check (priority_score >= 0 and priority_score <= 100),
  add column if not exists due_source text check (due_source in ('explicit', 'inferred', 'user')),
  add column if not exists merge_parent_id text references public.todos(id) on delete set null,
  add column if not exists next_review_at timestamptz,
  add column if not exists resolution_summary text,
  add column if not exists why_priority text;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  relationship text check (relationship in ('report', 'peer', 'external', 'investor', 'unknown')),
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_user_idx on public.people (user_id);

alter table public.people enable row level security;

create policy "people_all_own" on public.people
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.todos
  add column if not exists counterparty_person_id uuid references public.people(id) on delete set null;

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id text not null references public.todos(id) on delete cascade,
  source_app text not null,
  source_object_id text,
  author text,
  occurred_at timestamptz,
  excerpt text not null,
  deep_link text,
  extractor_version text,
  created_at timestamptz not null default now()
);

create index if not exists evidence_todo_idx on public.evidence (todo_id);
create index if not exists evidence_user_idx on public.evidence (user_id);

alter table public.evidence enable row level security;

create policy "evidence_all_own" on public.evidence
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.learned_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('sender', 'domain', 'calendar', 'keyword')),
  trigger_value text not null,
  effect text not null check (effect in ('suppress', 'boost', 'vip', 'never-task')),
  created_from_todo_id text references public.todos(id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learned_rules_user_idx on public.learned_rules (user_id) where not revoked;

alter table public.learned_rules enable row level security;

create policy "learned_rules_all_own" on public.learned_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
