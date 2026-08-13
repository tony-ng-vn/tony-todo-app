-- Store agent keys as SHA-256 hashes instead of plaintext. The plaintext
-- key is now shown exactly once at creation; a leaked session or XSS can
-- no longer read a long-lived credential back out of the database.
alter table public.agent_tokens rename column token to token_hash;

update public.agent_tokens
  set token_hash = encode(sha256(convert_to(token_hash, 'UTF8')), 'hex')
  where token_hash like 'dlg_%';

alter table public.agent_tokens drop constraint if exists agent_tokens_token_check;

alter table public.agent_tokens
  add constraint agent_tokens_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$');
