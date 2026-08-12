#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
APP_BUNDLE="$REPO_ROOT/.build/app-bundle/Done Log.app"
EXECUTABLE="$APP_BUNDLE/Contents/MacOS/done-log-menubar"

bash "$SCRIPT_DIR/build-menubar-app.sh" >/dev/null

if [[ ! -x "$EXECUTABLE" ]]; then
  echo "bundled executable is missing: $EXECUTABLE" >&2
  exit 1
fi

exec "$EXECUTABLE"
