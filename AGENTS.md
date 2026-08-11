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

## CI verification

- Run `npm run setup:hooks` once after cloning. `npm install` and `npm ci` also install the repository pre-push hook automatically.
- On macOS, every push runs `npm run verify` so local verification uses the required Node version, performs a clean install, and matches the required web and native CI checks.
- On other platforms, every push runs `npm run verify:web` and relies on the required `Native menu bar` GitHub check for the native build.
- Use `SKIP_VERIFY=1 git push` only for an emergency push when local verification cannot run, and report why in the PR.
- Keep the canonical verification commands in `package.json`; when a CI command changes, update the matching npm script in the same commit.
