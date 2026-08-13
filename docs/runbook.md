# Deploy runbook

Scope: deploying merged work to the live InsForge backend (project "Todo App", app key `y26ze9je`).
The frontend deploys itself through Vercel on merge; this runbook covers the backend, which is manual.

## Rules

- Deploy only from merged `main`, never from a feature branch or a dirty tree.
- Migrations always land in the repo before or together with being applied to the live database.
  If an urgent fix must be applied live first, commit and PR it in the same session so the repo never drifts from production.
- Test risky schema, RLS, or function changes on an InsForge backend branch first (`npx -y @insforge/cli branch create/switch/merge`), not on production.
- Never change the sign-up lock (`disable_signup`) in either direction without an explicit ask from the owner (see "Live backend ops truth" in AGENTS.md).
- The CLI login is interactive; the owner runs `npx -y @insforge/cli login --device` themselves on headless machines.

## Sequence

1. Sync and verify: `git checkout main && git pull`, then `npm ci && npm test`.
2. Preflight: `npx -y @insforge/cli current --json` confirms the linked project and auth.
   Compare `npx -y @insforge/cli db migrations list --json` against `migrations/` in both directions; stop and reconcile if either side has entries the other lacks.
3. Apply migrations: `npx -y @insforge/cli db migrations up --all`.
4. Redeploy changed functions: `npx -y @insforge/cli functions deploy <slug> --file functions/<slug>.ts`.
   `functions/agent-todos.ts` is generated from its shell file; deploy the generated file and never hand-edit it.
   When a migration renames or drops a column a function reads, apply the migration and redeploy that function in the same session.
5. Config: `npx -y @insforge/cli config plan`, then `npx -y @insforge/cli config apply -y` only for changes the owner approved.
6. Verify: the deployed functions return 401 to unauthenticated calls, `config plan` reports no drift, and `npx -y @insforge/cli logs function.logs --limit 20` shows no new errors.
7. Record: `npx -y @insforge/cli memory remember` the deploy fact, and cut a release with `npm run release:changelog -- <patch|minor|major>` when the deploy corresponds to one.

## Lessons already paid for

- Drop an old check constraint before backfilling a renamed column, or the backfill violates it and the migration rolls back.
- A conflicting PR silently prevents the GitHub Actions workflow from running; if CI seems missing, check mergeability first.
- The `insforge link` skill sync rewrites the `INSFORGE:START/END` block in AGENTS.md; project-owned content must live outside that block.
