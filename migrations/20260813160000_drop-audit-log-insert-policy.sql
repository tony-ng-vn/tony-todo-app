-- audit_log rows are only ever written by edge functions through the
-- admin client. The insert policy let any signed-in user forge audit
-- entries about themselves, so it goes away; select-own stays for the
-- Settings activity view.
drop policy if exists "audit_log_insert_own" on public.audit_log;
