# AGENTS.md

## Commits

Hard rule. Beats "keep PRs small". Beats a cloud-agent loop that says implement everything, then commit once.

A feature is a PR. A commit is one step. If a feature takes five steps across five components, that is five commits, not one. "GitHub deploys functions after CI" is a feature; the workflow file, the sync script, the tests, and the runbook are separate commits.

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

## Design

Glass surfaces, blurred backdrops, inset highlights, restrained borders. Scrollable regions stay scrollable with no visible scrollbar.

## Pull requests

Open PRs, watch CI, fix comments, and merge when required checks are green. Do not wait for a second ask.

Several agents work this repo at once:

- Before starting, check open PR paths (`gh pr list`, `gh pr diff --name-only`) and do not overlap them.
- Open a draft PR as soon as the branch exists. That is the claim on those files.
- Review the branch yourself before marking it ready. Hosted reviewers are rate-limited; do not wait on them.
- Merge with a merge commit, or enable auto-merge, when green; the head branch deletes itself.
- `package-lock.json` changes are their own PRs, never bundled with feature work.
- Keep PRs small and short-lived. One feature is still one commit per step (see Commits).
- Feature PRs add one `changelog.d/` fragment. Never edit `CHANGELOG.md` or a version field. Categories: Web App, Backend, Native App, CI & Tooling, Docs. Release compiles fragments with `npm run release:changelog -- <patch|minor|major>`.

## Native menu bar

`npm run menubar` / `menubar:dev` must use the `dev` instance lock and `com.tonynguyen.donelog.dev`. Never share the production lock or `doneLogQuit` notification. Do not run `menubar:install` unless replacing `/Applications/Done Log.app`.

## CI

- After clone: `npm run setup:hooks` (`npm install` / `npm ci` also install the pre-push hook).
- Push gate: macOS `npm run verify:push`; elsewhere `npm run verify:push:web`. GitHub always runs `npm run verify:web` and `npm run verify:native`.
- Local gate is lighter: toolchain, tests, production build. Clean install, the dependency audit, the native release build, and the app bundle stay in GitHub.
- `.ci/verification.json` `"pushGate": false` skips a stage locally only.
- Edge functions deploy from GitHub after Verify is green on `main`. Agents must not run `insforge functions deploy`.
- `SKIP_VERIFY=1 git push` is emergency-only; say why in the PR.
- Canonical commands live in `package.json`. Pair a CI command change with its npm script in the same commit (see Commits).
- CI lesson cache: `.ci-learning/` packets vs `.ci/lessons/`. `npm run ci:replay` after a lesson change. `npm run ci:repair` only on a feature branch; it must not commit, push, merge, or weaken checks. Treat generated lesson candidates as evidence before promoting them.

## Live backend

Skill sync cannot wipe this. The live project beats `docs/next-steps.md` and chat history.

- The owner already has `auth.users` rows (verified 2026-08-13). Never tell them to sign up, never create an owner account, never flip `disable_signup`.
- Functions are live only after `Deploy InsForge functions` is green. A Backend changelog entry is not production until then.
- One-time GitHub setup: repository secret `INSFORGE_USER_API_KEY` (`uak_` from InsForge Profile → API Keys). The project id is already in the workflow.
- Drift check: `npx -y @insforge/cli current --json` and `npx -y @insforge/cli config plan --json` (empty plan = no drift). The owner runs interactive `login` for dashboard/SQL work.
- Do not print `auth.users` emails unless asked.
