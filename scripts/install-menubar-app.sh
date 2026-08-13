#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SOURCE_APP="$REPO_ROOT/.build/app-bundle/Done Log.app"
SOURCE_BINARY="$SOURCE_APP/Contents/MacOS/done-log-menubar"
INSTALLED_APP="/Applications/Done Log.app"
INSTALLED_BINARY="$INSTALLED_APP/Contents/MacOS/done-log-menubar"

app_is_running() {
  pgrep -f -x "$INSTALLED_BINARY" >/dev/null
}

wait_for_app_exit() {
  local attempt
  for ((attempt = 0; attempt < 20; attempt += 1)); do
    if ! app_is_running; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

unset DONE_LOG_INSTANCE || true
unset DONE_LOG_INSTANCE_ID || true
unset DONE_LOG_BUNDLE_IDENTIFIER || true
unset DONE_LOG_BUNDLE_DISPLAY_NAME || true

bash "$SCRIPT_DIR/build-menubar-app.sh"

SOURCE_IDENTIFIER="$(
  /usr/bin/plutil \
    -extract CFBundleIdentifier \
    raw \
    "$SOURCE_APP/Contents/Info.plist"
)"
if [[ "$SOURCE_IDENTIFIER" != "com.tonynguyen.donelog" ]] \
  && [[ "$SOURCE_IDENTIFIER" != "com.tonynguyen.donelog.macos" ]]; then
  echo "refusing to install a development Done Log ($SOURCE_IDENTIFIER)" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_APP/Contents/Frameworks/Sparkle.framework" ]]; then
  echo "refusing to replace Done Log with a build that is missing Sparkle" >&2
  exit 1
fi

SOURCE_VERSION="$(
  /usr/bin/plutil \
    -extract CFBundleShortVersionString \
    raw \
    "$SOURCE_APP/Contents/Info.plist"
)"

if [[ -e "$INSTALLED_APP" && ! -d "$INSTALLED_APP" ]]; then
  echo "installation target is not an app directory: $INSTALLED_APP" >&2
  exit 1
fi

if [[ ! -w "/Applications" ]]; then
  echo "/Applications is not writable for the current user" >&2
  echo "copy $SOURCE_APP to /Applications using Finder" >&2
  exit 1
fi

if [[ -d "$INSTALLED_APP" ]]; then
  INSTALLED_IDENTIFIER="$(
    /usr/bin/plutil \
      -extract CFBundleIdentifier \
      raw \
      "$INSTALLED_APP/Contents/Info.plist"
  )"
  if [[ "$INSTALLED_IDENTIFIER" != "com.tonynguyen.donelog" ]] \
    && [[ "$INSTALLED_IDENTIFIER" != "com.tonynguyen.donelog.macos" ]]; then
    echo "refusing to replace an app with another bundle identifier" >&2
    exit 1
  fi

  INSTALLED_VERSION="$(
    /usr/bin/plutil \
      -extract CFBundleShortVersionString \
      raw \
      "$INSTALLED_APP/Contents/Info.plist"
  )"
  VERSION_STATUS=0
  "$SCRIPT_DIR/app-version-is-newer.sh" \
    "$INSTALLED_VERSION" \
    "$SOURCE_VERSION" \
    || VERSION_STATUS=$?
  if [[ "$VERSION_STATUS" -eq 0 ]]; then
    echo "refusing to replace newer Done Log $INSTALLED_VERSION with $SOURCE_VERSION" >&2
    exit 1
  fi
  if [[ "$VERSION_STATUS" -ne 1 ]]; then
    echo "could not safely compare Done Log app versions" >&2
    exit 1
  fi

  if [[ -x "$INSTALLED_BINARY" ]]; then
    "$INSTALLED_BINARY" --unregister-login-item || true
  fi

  "$SOURCE_BINARY" --quit-running
  if ! wait_for_app_exit; then
    while IFS= read -r running_pid; do
      if [[ "$running_pid" =~ ^[0-9]+$ ]]; then
        kill -TERM "$running_pid"
      fi
    done < <(pgrep -f -x "$INSTALLED_BINARY")
  fi

  if ! wait_for_app_exit; then
    echo "Done Log is still running; quit it and run the installer again" >&2
    exit 1
  fi

  rm -rf "$INSTALLED_APP"
fi

/usr/bin/ditto "$SOURCE_APP" "$INSTALLED_APP"
/usr/bin/codesign --verify --deep --strict "$INSTALLED_APP"

echo "Done Log is installed at $INSTALLED_APP."
echo "Open it from Applications when you are ready."
