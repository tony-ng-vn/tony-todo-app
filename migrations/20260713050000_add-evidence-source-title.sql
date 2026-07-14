-- Lets the Meetings view (docs/PRD.md Section 5) group loops by their
-- source meeting with a readable name, instead of an opaque Granola note
-- id. Nullable since existing evidence rows predate this column.
alter table public.evidence
  add column if not exists source_title text;
