#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
APP_BUNDLE="$REPO_ROOT/.build/app-bundle/Daymark.app"
EXECUTABLE="$APP_BUNDLE/Contents/MacOS/done-log-menubar"

INSTANCE_ID="$(
  printf '%s' "$REPO_ROOT" | shasum -a 256 | awk '{ print substr($1, 1, 12) }'
)"
export DONE_LOG_INSTANCE="${DONE_LOG_INSTANCE:-dev}"
export DONE_LOG_INSTANCE_ID="${DONE_LOG_INSTANCE_ID:-$INSTANCE_ID}"
export DONE_LOG_BUNDLE_IDENTIFIER="${DONE_LOG_BUNDLE_IDENTIFIER:-com.tonynguyen.donelog.dev}"
export DONE_LOG_BUNDLE_DISPLAY_NAME="${DONE_LOG_BUNDLE_DISPLAY_NAME:-Daymark Local}"

bash "$SCRIPT_DIR/build-menubar-app.sh" >/dev/null

if [[ ! -x "$EXECUTABLE" ]]; then
  echo "bundled executable is missing: $EXECUTABLE" >&2
  exit 1
fi

exec "$EXECUTABLE"
