#!/usr/bin/env bash
# Cursor Cloud Agent environment: per-boot runtime initialization.
# Runs on every start. Must tolerate restarts and must NOT fail the boot on
# backend issues — frontend work has to proceed even if the backend is down.
set -uo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 24 >/dev/null 2>&1 || true

# --- InsForge CLI: non-interactive auth + link ------------------------------
# Authenticate with the uak_ user API key held in the INSFORGE_USER_API_KEY
# cloud secret, then link this checkout to the Todo App project so agents can
# run migrations/SQL/RLS/functions without the interactive browser login. The
# link file (.insforge/project.json) is gitignored and ephemeral per VM, so it
# is recreated here on each boot. Output is silenced to keep account emails out
# of boot logs.
# Pinned + --offline so this resolves the npm-ci-installed copy (install.sh)
# instead of executing a floating registry build while the key is in scope.
# Keep the version in lockstep with package.json's @insforge/cli devDependency;
# src/ciWorkflow.test.js enforces the match.
if [ -n "${INSFORGE_USER_API_KEY:-}" ]; then
  echo "Authenticating InsForge CLI (non-interactive)..."
  if npx -y --offline @insforge/cli@0.2.6 login --user-api-key "$INSFORGE_USER_API_KEY" >/dev/null 2>&1 \
    && npx -y --offline @insforge/cli@0.2.6 link \
      --project-id 7e77e15d-9e4d-4591-9951-8b99289200cd \
      --org-id b74bafa2-a05e-479e-a2b6-5290bfd9ad13 >/dev/null 2>&1; then
    echo "InsForge CLI authenticated and linked to Todo App."
  else
    echo "InsForge CLI auth/link failed; backend work may need a manual 'insforge login'."
  fi
else
  echo "INSFORGE_USER_API_KEY not set; skipping InsForge CLI auth (add it as a cloud secret for autonomous backend access)."
fi
