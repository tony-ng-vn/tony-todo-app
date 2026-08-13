# Changelog

## v0.10.1

2026-08-13

**Backend**

- Fixed the agent-key hashing migration so it applies cleanly on a fresh database: the old key-format check is now removed before existing keys are rewritten as hashes.
- The repo now tracks two migrations that were already live (YouTube watch items and knowledge cards, wider audit-log action types), so a fresh environment matches production.

**Docs**

- Design rules moved out of the tool-managed section of AGENTS.md so automated syncs cannot delete them again.

---

## v0.10.0

2026-08-13

**Backend**

- Public sign-up is disabled, so strangers can no longer create accounts on the live app while it holds a single owner's data.
- Granola ingestion and follow-up drafting now only run for the owner account, closing a hole where any signed-in user could pull the owner's meeting notes into their own account.
- Meeting titles, summaries, and transcripts are now clearly fenced as untrusted data in the AI prompts, so a hostile calendar guest cannot smuggle instructions into loop extraction.
- Ingestion and drafting are rate limited per user, so a stolen session can no longer burn through the AI and Granola quotas.
- Agent keys are now stored as one-way hashes; nobody, including the account owner, can read a key back out of the database after creation.
- Users can no longer write entries into their own activity log, so the audit trail only ever reflects what the system actually did.
- New passwords must be at least 12 characters.

**Web App**

- The agent key is now shown exactly once when created; the Settings list keeps only the key's name, matching what the UI already promised.

**Docs**

- The owner onboarding guide now reflects that the owner account already exists: the remaining work is pointing the app at it, not signing up.

---
