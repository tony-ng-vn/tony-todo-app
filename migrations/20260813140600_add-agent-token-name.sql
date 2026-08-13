-- Existing keys keep a fallback name so Settings can show a label
-- without revealing the secret after the one-time copy step.
alter table public.agent_tokens
  add column if not exists name text not null default 'Agent key';

alter table public.agent_tokens
  drop constraint if exists agent_tokens_name_check;

alter table public.agent_tokens
  add constraint agent_tokens_name_check
  check (char_length(btrim(name)) between 1 and 40);
