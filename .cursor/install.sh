#!/usr/bin/env bash
# Cursor Cloud Agent environment: durable, source-derived setup.
# Runs at build/install time and is snapshotted into the environment build.
# Must be idempotent, non-interactive, and terminate successfully.
set -euo pipefail

# --- Node.js 24 (required by .node-version) ---------------------------------
# The base image's default `node` (served via /exec-daemon) is an older major
# and sits early in PATH. Install Node 24 through nvm and make interactive
# login shells prefer it, so `node`/`npm` and the `check:node-toolchain` gate
# resolve to 24.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm install 24
nvm alias default 24
nvm use 24

if ! grep -q 'NODE24_BIN' "$HOME/.bashrc" 2>/dev/null; then
  cat >> "$HOME/.bashrc" <<'RC'

# Prefer nvm's Node 24 over the /exec-daemon default node in interactive shells.
NODE24_BIN="$(dirname "$(nvm which 24 2>/dev/null)" 2>/dev/null)"
if [ -n "$NODE24_BIN" ] && [ -x "$NODE24_BIN/node" ]; then
  export PATH="$NODE24_BIN:$PATH"
fi
RC
fi

# --- Project dependencies ----------------------------------------------------
# `npm ci` is deterministic against package-lock.json; `prepare` installs the
# repo git hooks.
npm ci
