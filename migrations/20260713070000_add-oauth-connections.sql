-- Generic OAuth connection storage, ready for Gmail/Calendar (or Slack,
-- later) once real OAuth credentials exist. Schema only: no code writes
-- to this table yet, and no provider-specific integration exists until
-- a real Google Cloud OAuth app is set up (see docs/google-oauth-setup.md).
--
-- SECURITY NOTE: access_token/refresh_token are stored as plain text
-- columns here as a structural placeholder. Before any real token is
-- ever written to this table, revisit encryption at rest (e.g. pgcrypto,
-- or storing tokens via InsForge secrets keyed by connection id instead
-- of in this table directly) -- do not ship this as-is with real
-- credentials.
create table if not exists public.oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.oauth_connections enable row level security;

create policy "oauth_connections_all_own" on public.oauth_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
