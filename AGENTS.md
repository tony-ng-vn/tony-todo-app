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

Design rules:

- Keep this app in the glass design system: translucent surfaces, blurred backdrops, soft inset highlights, and restrained borders.
- Never ship visible scrollbars. Scrollable regions should remain scrollable but hide native scrollbar rails/thumbs.
<!-- INSFORGE:END -->

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
- Use `SKIP_VERIFY=1 git push` only for an emergency push when local verification cannot run, and report why in the PR.
- Keep the canonical verification commands in `package.json`; when a CI command changes, update the matching npm script in the same commit.
- CI failures are cached as redacted packets in `.ci-learning/` and matched against the versioned lessons in `.ci/lessons/`.
- Run `npm run ci:replay` when a CI lesson changes.
- Run `npm run ci:repair` only on a feature branch when an AI repair loop is wanted. It must remain bounded and must not commit, push, merge, or weaken checks.
- Treat generated lesson candidates as evidence. Review their context, solution, and tradeoffs before promoting and committing them.
