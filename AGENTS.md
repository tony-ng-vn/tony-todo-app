# AGENTS.md

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
- A small PR is not one commit. See Commits.

## Commits

This section is the commit rule. Cloud agents, hosted agents, and local agents all follow it. "Keep PRs small" is not permission to squash a feature into one commit at the end.

- One idea per commit. `git show` on that commit must make sense without the rest of the branch.
- Commit as you go, in this order when it applies: failing test, then the fix, then docs.
- Never implement the whole PR and `git add` every changed file into a single commit before opening or updating the PR. That is a rule violation even if tests are green.
- Run `npm test` before every commit (a narrower vitest path is fine when that is the whole change). The push gate is extra, not a substitute.
- Conventional `type(scope):` subject. Plain ASCII. No agent names or tool Co-authored-by lines (see the contribution policy).
- Same-commit pairing is required only for these, and only these:
  - a CI command and the matching `package.json` script
  - a changelog fragment and the change it describes
- Do not mix unrelated workflow, product, and docs edits in one commit just because they will ship in one PR.

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
- InsForge edge functions are not deployed by the local push gate or by cloud agents. After the required `Verify` job is green on `main`, GitHub Actions deploys changed files under `functions/` and fails if live source still does not match the repo.
- Use `SKIP_VERIFY=1 git push` only for an emergency push when local verification cannot run, and report why in the PR.
- Keep the canonical verification commands in `package.json`. When a CI command changes, pair that script in the same commit (see Commits).
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
- Edge functions go live only from GitHub Actions after CI is green on `main`. Agents must not run `insforge functions deploy`. A Backend changelog entry describes merged code; it is not production until the `Deploy InsForge functions` job is green.
- One-time GitHub setup: add repository secret `INSFORGE_USER_API_KEY` (InsForge dashboard → Profile → API Keys, a `uak_` key). The project id is already in the workflow.
- To check live config drift: `npx -y @insforge/cli current --json` (project link and auth) and `npx -y @insforge/cli config plan --json` (empty output means no drift). The CLI login is interactive, so the owner runs `npx -y @insforge/cli login` themselves for dashboard/SQL work.
- Do not print `auth.users` emails into chat or logs unless the owner asks; row existence is enough.
