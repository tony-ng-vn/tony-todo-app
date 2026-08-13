# Deploy runbook

Scope: deploying merged work to the live InsForge backend (project "Todo App", app key `y26ze9je`).
The frontend deploys itself through Vercel on merge.
Edge functions deploy from GitHub Actions after the `CI` workflow is green on `main`.
Migrations and `insforge.toml` config apply stay manual.

## Rules

- Do not deploy functions from a laptop, a feature branch, a dirty tree, or a cloud agent.
- Function deploys wait for the required `Verify` job. A Backend changelog entry is not live until the `Deploy InsForge functions` job is green.
- One-time: add GitHub repository secret `INSFORGE_USER_API_KEY` (InsForge dashboard → Profile → API Keys).
- Migrations always land in the repo before or together with being applied to the live database.
  If an urgent fix must be applied live first, commit and PR it in the same session so the repo never drifts from production.
- Test risky schema, RLS, or function changes on an InsForge backend branch first (`npx -y @insforge/cli branch create/switch/merge`), not on production.
- Never change the sign-up lock (`disable_signup`) in either direction without an explicit ask from the owner (see "Live backend ops truth" in AGENTS.md).
- The CLI login is interactive; the owner runs `npx -y @insforge/cli login --device` themselves on headless machines for SQL and config work.

## Sequence

1. Merge to `main`. Vercel ships the web app. GitHub `CI` runs `verify:web` and `verify:native`.
2. When `CI` succeeds on a `main` push, `InsForge functions` deploys each changed `functions/*.ts` file (not `*.shell.ts`) and fails if live source still does not match the repo.
   `functions/agent-todos.ts` is generated from its shell file; the job deploys the generated file. Never hand-edit it.
   To replay a deploy by hand, run the `InsForge functions` workflow from Actions (`workflow_dispatch` deploys every repo function, then re-checks live source).
3. Sync and verify before migrations: `git checkout main && git pull`, then `npm ci && npm test`.
4. Preflight: `npx -y @insforge/cli current --json` confirms the linked project and auth.
   Compare `npx -y @insforge/cli db migrations list --json` against `migrations/` in both directions; stop and reconcile if either side has entries the other lacks.
5. Apply migrations: `npx -y @insforge/cli db migrations up --all`.
   When a migration renames or drops a column a function reads, apply the migration and let the GitHub function job redeploy in the same merge, or run `workflow_dispatch` immediately after `migrations up`.
6. Config: `npx -y @insforge/cli config plan`, then `npx -y @insforge/cli config apply -y` only for changes the owner approved.
7. Verify: the deployed functions return 401 to unauthenticated calls, `config plan` reports no drift, and `npx -y @insforge/cli logs function.logs --limit 20` shows no new errors.
8. Record: `npx -y @insforge/cli memory remember` the deploy fact, and cut a release with `npm run release:changelog -- <patch|minor|major>` when the deploy corresponds to one.

## Lessons already paid for

- Drop an old check constraint before backfilling a renamed column, or the backfill violates it and the migration rolls back.
- A conflicting PR silently prevents the GitHub Actions workflow from running; if CI seems missing, check mergeability first.
- The `insforge link` skill sync rewrites the `INSFORGE:START/END` block in AGENTS.md; project-owned content must live outside that block.
- Merging GitHub is not a function deploy. A successful laptop `functions deploy` can still ship a stale local file.
- Looking up agent keys on a `token` column after the hashing migration 401s every `dlg_` key; live source must use `token_hash`.
