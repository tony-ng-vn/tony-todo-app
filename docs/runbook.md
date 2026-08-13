# Deploy and release runbook

Scope: deploying merged work to the live InsForge backend and publishing the native Done Log macOS application.
The frontend deploys itself through Vercel on merge.

## Backend deploy

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

## Native app release

The native release workflow publishes a complete signed application, the legacy bootstrap disk image, and the Sparkle update feed.
It runs only for a version tag and never publishes an unsigned build from a pull request.

### One-time signing setup

The `native-release` GitHub environment requires owner approval, and only protected `v*` tags may target it.
Configure these encrypted environment secrets before creating the first native release:

- `MACOS_DEVELOPER_ID_P12`: Base64-encoded Developer ID Application certificate and private key exported as a `.p12` file.
- `MACOS_DEVELOPER_ID_PASSWORD`: Password used when exporting that `.p12` file.
- `APPLE_NOTARY_KEY`: Contents of an App Store Connect API private key with notarization access.
- `APPLE_NOTARY_KEY_ID`: Key identifier for the notarization API key.
- `APPLE_NOTARY_ISSUER_ID`: Issuer identifier for the notarization API key.
- `SPARKLE_PRIVATE_KEY`: Exported Sparkle EdDSA private key.

The Sparkle private key is already generated for `com.tonynguyen.donelog` and must remain in the macOS Keychain and GitHub Actions secrets only.
Never commit any private key, certificate, or password.

### Release sequence

1. Merge feature work first, then start from a clean and current `main` worktree.
2. Run `npm ci` and `npm run verify`.
3. Run `npm run release:changelog -- <patch|minor|major>` to compile every pending fragment, bump the web and native versions, increment `CFBundleVersion`, refresh the lockfile, and consume the fragments.
4. Commit the generated release changes with a Conventional Commit such as `chore(release): prepare v0.12.0`, open a release PR, and merge it only after required checks pass.
5. Create and push the matching version tag from the merged release commit, such as `v0.12.0`.
6. Watch the `Native release` workflow until signing, application notarization, disk-image notarization, and publication all succeed.
7. Confirm the GitHub release contains `Done-Log-<version>.zip`, `Done-Log.dmg`, and `appcast.xml`.
8. Open the stable `releases/latest/download/appcast.xml` URL and confirm it points to the tagged archive before testing an update from the previous notarized Done Log release.

### Legacy bootstrap

Versions without Sparkle cannot replace themselves.
Their hosted menu bar page shows `Install desktop update` and opens the stable `Done-Log.dmg` download.
Drag the new Done Log into Applications once, replacing the legacy bundle if Finder asks.
Every later release uses `Check for Updates` and completes the signed in-app update through Sparkle.
