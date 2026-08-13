# Learnings

## 2026-08-13: Worktree Done Log stole the production tray

- **Root cause:** `npm run menubar` from a worktree built `.build/app-bundle/Done Log.app` with the production bundle id and the shared lock `com.tonynguyen.done-log-menubar.lock`.
  That process replaced `/Applications/Done Log.app` in the tray.

- **Wrong assumptions:**
  - A local Swift build would stay isolated because it lives under `.build/` or `.worktrees/`.
    Disproved: macOS keys menu-bar extras by bundle id, and the host also used one process lock plus production quit/show notifications.
  - Installing to Applications is the only way a worktree run can touch the production extra.
    Disproved: launching the local bundle with the production identity is enough.

- **Fix pattern:** Local runs set `DONE_LOG_INSTANCE=dev`, a worktree-specific lock, and bundle id `com.tonynguyen.donelog.dev`.
  Install to `/Applications` unsets those overrides so production identity, lock, and quit/show notifications stay intact.
  A local test extra can appear as "Done Log Local" without quitting the installed app.

- **Detection signal:** `pgrep -fl done-log-menubar` shows a `.worktrees/` or `.build/app-bundle/` path instead of `/Applications/Done Log.app`.
