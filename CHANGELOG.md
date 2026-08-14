# Changelog

## v0.11.3

2026-08-13

**Web App**

- Every dash in a task note now gets its own time instead of the whole block you typed in one sitting sharing a single timestamp.
- Reordering bullets in a note keeps each bullet's original time with it, instead of the times swapping between bullets.
- The main task, board, and recap panels now lead with their useful headings instead of repeating decorative product labels above them.
- Opening a task on iPhone now shows the notes and time page on screen, instead of leaving it below the list where it looked like nothing happened.
- The menu bar update control now distinguishes a full desktop update from a simple web reload.
- Task details and the daily progress divider no longer repeat decorative page labels above useful content.
- Task notes now show Markdown and pasted web links as clean, clickable highlighted links when you are not actively editing them.

**Backend**

- Agents reading a task's notes now see a separate time for each bullet, matching the same per-bullet granularity as the web app.

**Native App**

- The full Done Log window now appears as a regular macOS app with its own Dock icon and application menu, while the compact menu-bar control stays available.
- Done Log now keeps one stable menu-bar item and respects the macOS Menu Bar permission instead of creating duplicate or hidden registrations during launch recovery.
- Opening Done Log now activates its full window once, so menu-bar recovery no longer steals focus back from the next app you click.
- The full window now stays visible behind other apps instead of disappearing when Done Log loses focus.
- Empty header space now moves the window with a normal macOS drag instead of leaving the window stuck in place.
- Resizing the full window down to its minimum size now keeps a compact desktop layout across tasks, details, board, and calendar instead of collapsing into the phone layout.
- Keep Done Log a menu-bar app when the window is open, and turn the tray extra on in Control Center so it can sit in the menu bar instead of getting parked off the right edge.
- Searching for Done Log and clicking Open now shows the full window even if the menu bar extra has not appeared yet.
- The menu bar checkmark now waits until macOS actually hosts it before the full Done Log window opens, so the icon no longer disappears after launch.
- Local `npm run menubar` builds stay off the installed app, and the installer refuses development or Sparkle-less bundles so production Done Log cannot be overwritten by accident.
- Done Log can securely check for, install, and relaunch into signed native updates from the menu bar or application menu.
- Keep legacy Done Log builds on the working web reload action until the first signed desktop installer is actually published.
- Reopening Done Log now refreshes the current web document, so shipped interface fixes appear without requiring a full app restart.
- The full window now keeps an even outer inset, aligned panel headings and cards, and readable task and recap columns down to its minimum size.
- The menu bar checkmark now reuses the same stable identity shown in macOS System Settings instead of registering another hidden item.
- Menu bar and floating task notes now use the same readable link treatment as the full app.
- Task quick notes now stay floating when you switch to another app and remain open until you close them.
- Quick notes now include a Mini todos button that reopens the menu-bar task list without closing the note.

**CI & Tooling**

- Concurrent PRs no longer conflict on the changelog or version number: each PR now drops its own changelog fragment, and releases compile them into CHANGELOG.md and bump the version in one step.
- Merging a function change to main now deploys it from GitHub after tests pass, and the job fails if live source still does not match the repo.
- Manual runs are limited to `main`, and the locked InsForge CLI is installed before deployment credentials are exposed.
- Manual replays require a green CI run and prove migrations and config already match production before function writes.
- Function deletion and migration-order conflicts now stop before any production function is changed.
- Main CI runs stay queued instead of cancelling each other, and a deployment marker makes every run reconcile the full not-yet-deployed range without rolling production back to an older commit.
- Deploy preflight catches renamed or unexpected live endpoints before writes.
- Native releases now build, sign, notarize, and publish the update archive and feed through one guarded workflow.

**Docs**

- Backend changelog entries describe merged code; they are not live until the InsForge functions GitHub job is green. Agents must not deploy functions.
- The deploy runbook now treats GitHub Actions as the function deploy path; laptop deploys are not the production path.
- AGENTS.md now leads with the incremental commit rule, before the InsForge skill-sync block. A feature is a PR; each component step is its own commit.
- Documented the one-time legacy bootstrap and the native release procedure.
- Agents now claim work by opening draft PRs early, review their own branches before marking PRs ready, and keep dependency bumps in separate PRs, so parallel agents stop colliding.
- A deploy runbook documents the safe backend deploy sequence, including the migration drift check and the lessons learned from the v0.10.0 deploy.

---

## v0.11.2

2026-08-13

**Native App**

- Opening a task quick note no longer opens the full Done Log window at the same time.

---

## v0.11.1

2026-08-13

**Web App**

- Pressing Enter at the bottom of a long task note now keeps the caret in view instead of leaving you looking at earlier lines.

---

## v0.11.0

2026-08-13

**Backend**

- The agent HTTP API now has a `describe` command that returns the live command list, timezone, and `apiVersion`.
- Unknown commands return that catalog instead of a dead error, so a stale paste can recover on the next call.
- Successful responses include `apiVersion`, so a long-running session can notice when the catalog changed and call `describe` again.

**Web App**

- Copied agent setup no longer lists every command. It tells the tool to call `describe` first, so new features show up without recopying setup.

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
