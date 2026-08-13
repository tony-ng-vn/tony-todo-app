# AGENTS.md

## Commits

Hard rule.
This beats "keep PRs small" and any workflow that says to implement everything before committing once.

A feature is a PR.
A commit is one step.
If a feature takes five steps across five components, that is five commits, not one.
"GitHub deploys functions after CI" is a feature; the workflow file, the sync script, the tests, and the runbook are separate commits.

- One step per commit: one test, one script, one workflow, one docs pass. `git show` on that commit must make sense without the rest of the branch.
- Commit as you go, in this order when it applies: failing test, then the fix, then docs.
- Never implement the whole PR and `git add` every changed file into a single commit before opening or updating the PR. That is a rule violation even if tests are green.
- Run `npm test` before every commit (a narrower vitest path is fine when that is the whole change). The push gate is extra, not a substitute.
- Conventional `type(scope):` subject. Plain ASCII. No agent names or tool Co-authored-by lines.
- Same-commit pairing is required only for these, and only these:
  - a CI command and the matching `package.json` script
  - a changelog fragment and the change it describes
- Do not mix unrelated workflow, product, and docs edits in one commit just because they will ship in one PR.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **Todo App** (API base `https://y26ze9je.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

## Design rules

These live outside the INSFORGE block on purpose: a skill sync rewrites that block and once wiped this section.

- Keep this app in the glass design system: translucent surfaces, blurred backdrops, soft inset highlights, and restrained borders.
- Never ship visible scrollbars. Scrollable regions should remain scrollable but hide native scrollbar rails/thumbs.

## Pull requests

Agents have permission to open PRs, watch CI, fix review comments, and merge when required checks are green and comments are addressed. Do not wait for a second ask.

## Working in parallel

Several agents work this repo concurrently; these rules keep them from colliding.

- Before starting a task, check open PRs' changed paths (`gh pr list` plus `gh pr diff --name-only <n>`) and prefer work that does not overlap an in-flight PR.
- Open your PR as a draft as soon as the branch exists, before the implementation is done.
  A draft PR is the visible claim on the files you are touching.
- Run a code-review pass over the branch before marking the PR ready (in Claude Code use `/code-review`; elsewhere an equivalent reviewer pass), and address what it finds.
  The hosted reviewers (CodeRabbit, Copilot) are rate limited and must not be relied on.
- When checks are green and comments addressed, merge, or enable auto-merge (merge commit) and move on; the head branch deletes itself on merge.
- Dependency changes (`package-lock.json`) go in their own small PRs, never bundled with feature work.
- Keep PRs small and short-lived; a long-lived branch in this repo will need repeated merges from main because required checks are strict.

## Native menu bar

- Local `npm run menubar` / `menubar:dev` from a worktree must use the `dev` instance lock and `com.tonynguyen.donelog.dev`. Never share the production lock or `doneLogQuit` notification, or a test run will steal or quit `/Applications/Done Log.app`.
- Use `npm run menubar:install` only when you intend to replace the installed production app.

## CI verification

- Run `npm run setup:hooks` once after cloning. `npm install` and `npm ci` also install the repository pre-push hook automatically.
- On macOS, every push runs `npm run verify:push`: it runs the toolchain checks, the web and native test suites, and the production build, while the required native build checks remain in GitHub CI.
- On other platforms, every push runs `npm run verify:push:web` and relies on the required `Native menu bar` GitHub check for the native build.
- The local push gate is intentionally lighter than CI: it checks the toolchain, runs the test suite, and runs the production build.
- Clean install, the dependency audit, the native release build, and the native app bundle are not part of the local push gate. They stay covered by the required GitHub checks, which always run the full plan via `npm run verify:web` and `npm run verify:native`.
- `.ci/verification.json` marks a stage `"pushGate": false` to exclude it from local pushes; CI ignores that flag and always runs every stage.
- Edge functions deploy from GitHub after CI is green on `main`.
  Agents must not run `insforge functions deploy`.
- Use `SKIP_VERIFY=1 git push` only for an emergency push when local verification cannot run, and report why in the PR.
- Keep the canonical verification commands in `package.json`; when a CI command changes, update the matching npm script in the same commit.
- CI failures are cached as redacted packets in `.ci-learning/` and matched against the versioned lessons in `.ci/lessons/`.
- Run `npm run ci:replay` when a CI lesson changes.
- Run `npm run ci:repair` only on a feature branch when an AI repair loop is wanted. It must remain bounded and must not commit, push, merge, or weaken checks.
- Treat generated lesson candidates as evidence. Review their context, solution, and tradeoffs before promoting and committing them.

## Changelog

- CHANGELOG.md entries use these categories, matching the project's architecture: `Web App` (SvelteKit frontend), `Backend` (InsForge functions, migrations, auth config), `Native App` (macOS menu bar companion), `CI & Tooling` (hooks, scripts, verification), `Docs`.
- Feature PRs never edit `CHANGELOG.md` or a version field directly. Instead, each PR adds one fragment file to `changelog.d/` describing its own change; see `changelog.d/README.md` for the exact format.
- Only include the categories a fragment's change actually touched.
- At release time, run `npm run release:changelog -- <patch|minor|major>` to compile every fragment into a new CHANGELOG.md entry, bump the version in `package.json` and `native/App/Info.plist`, refresh the lockfile, and delete the consumed fragments.
- This keeps concurrent PRs from conflicting on a shared changelog or version line.

## Live backend ops truth

This section is durable operational fact, kept outside the INSFORGE block so a skill sync cannot wipe it.

- The owner already has live app accounts in `auth.users` (verified 2026-08-13). Never tell the owner to sign up, never create an owner account, and never re-enable sign-up for that purpose.
- Never change the sign-up lock state (`disable_signup`) in either direction without an explicit ask from the owner.
- `docs/next-steps.md` describes remaining one-time setup, but treat the live project as the source of truth over any doc or chat history.
- Functions are live only after `Deploy InsForge functions` is green.
  A Backend changelog entry is not production until then.
- One-time GitHub setup requires repository secret `INSFORGE_API_KEY`, using the admin key from the linked Todo App project.
  The project URL is already in the workflow.
- To check live state: `npx -y @insforge/cli current --json` (project link and auth) and `npx -y @insforge/cli config plan --json` (drift between `insforge.toml` and the live config; empty output means no drift). The CLI login is interactive, so the owner runs `npx -y @insforge/cli login` themselves.
- Do not print `auth.users` emails into chat or logs unless the owner asks; row existence is enough.

## Cursor Cloud specific instructions

- Only the SvelteKit **web app** is runnable in the Linux cloud VM. The native macOS menu-bar app (`native/`, `npm run menubar*`, `npm run build:native-menubar`, `npm run test:native-menubar`) is macOS/Swift-only and cannot be built or tested here; treat it as out of scope on this VM.
- **Node.js 24 is required** (`.node-version`) and `scripts/check-node-toolchain.mjs` fails on any other major. The VM's `/exec-daemon/node` default is Node 22 and sits early in `PATH`; a login shell resolves `node` to nvm's Node 24 because `~/.bashrc` prepends it. Run repo commands through a login shell (e.g. `bash -lc '…'`) so `node`/`npm` are 24; a bare non-login shell can silently fall back to Node 22 and fail the toolchain check. This includes `git push`: the `.githooks/pre-push` gate runs `check:node-toolchain`, so push from a login shell (`bash -lc 'git push …'`) or it will be rejected under Node 22.
- The backend (InsForge) is a **remote hosted BaaS**, not a local service. For local UI/e2e work, run the web app and open it with `?local=1` (e.g. `http://127.0.0.1:5173/?local=1`) to use browser storage with no account — no `.env.local` or backend needed. `.env.local` (from `.env.example`) is only needed for real cloud sync/auth.
- Standard commands live in `package.json`: dev server `npm run dev` (serves `http://127.0.0.1:5173`), unit tests `npm test` (Vitest), build `npm run build`. There is no JS linter/formatter; the "lint-like" gates are `npm run check:node-toolchain` and `npm run check:contribution-policy`.
- In the task-row controls, the checkmark completes a task; the rightmost `X` marks it **Failed**. Click the checkmark (not the `X`) when verifying the complete-a-task flow.
- **Autonomous InsForge backend access (CLI).** Cloud agents authenticate the `insforge` CLI **non-interactively** with the `uak_…` user API key stored in the `INSFORGE_USER_API_KEY` cloud secret — do not wait for the interactive browser login. The `.insforge/project.json` link file is gitignored and is not carried between fresh VMs, so re-link each session. Before backend work, run (from a login shell):
  - `npx -y @insforge/cli@latest login --user-api-key "$INSFORGE_USER_API_KEY"`
  - `npx -y @insforge/cli@latest link --project-id 7e77e15d-9e4d-4591-9951-8b99289200cd --org-id b74bafa2-a05e-479e-a2b6-5290bfd9ad13` (project "Todo App", appkey `y26ze9je`, under "Personal Org")
  - Verify with `npx -y @insforge/cli@latest config plan --json` (empty `changes` = in sync). This does not print `auth.users` emails; keep it that way. If `INSFORGE_USER_API_KEY` is unset, the CLI cannot authenticate — ask the owner to add it as a cloud secret rather than falling back to interactive login.
- **App runtime secrets are pre-injected.** `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY` are provided as cloud secrets (env vars), so `npm run dev`/`npm run build` connect to the live backend without a local `.env.local`. Backend edge-function secrets (`API_KEY`, `OPENROUTER_API_KEY`, `INGEST_FUNCTION_TOKEN`, etc. in `functions/*.ts`) live on the InsForge backend, not in the agent VM, and are managed via `insforge secrets` / the dashboard.
