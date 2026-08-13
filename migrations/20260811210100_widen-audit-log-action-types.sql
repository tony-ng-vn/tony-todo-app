alter table public.audit_log
  drop constraint if exists audit_log_action_type_check;

alter table public.audit_log
  add constraint audit_log_action_type_check
  check (action_type in ('loop_created', 'draft_generated', 'video_knowledge_extracted'));
