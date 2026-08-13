# Changelog

## v0.11.0

2026-08-13

**Backend**

- The agent HTTP API now has a `describe` command that returns the live command list, timezone, and `apiVersion`.
- Unknown commands return that catalog instead of a dead error, so a stale paste can recover on the next call.
- Successful responses include `apiVersion`, so a long-running session can notice when the catalog changed and call `describe` again.

**Web App**

- Copied agent setup no longer lists every command. It tells the tool to call `describe` first, so new features show up without recopying setup.

**Web App**

- Pressing Enter at the bottom of a long task note now keeps the caret in view instead of leaving you looking at earlier lines.

---

## v0.10.2

2026-08-13

**Native App**

- Task notes now use the same dark native chrome as the full window, so they no longer show a separate white system title bar.

**Docs**

- Agents may open PRs, watch CI, fix review comments, and merge when the PR is ready.

---

## v0.10.1

2026-08-13

**Native App**

- The full app window now uses unified macOS chrome: the workspace draws under the traffic lights instead of sitting below a separate title-bar strip, and empty header space still double-click zooms.

**Web App**

- Native-host layout no longer reserves a blank bar above the panels; left headers indent past the window controls.

**Docs**

- The menu bar companion notes now describe drag and zoom on the traffic-light area and empty headers.

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
