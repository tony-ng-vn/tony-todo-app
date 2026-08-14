#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
SOURCE_APP="$REPO_ROOT/.build/app-bundle/Daymark.app"
SOURCE_BINARY="$SOURCE_APP/Contents/MacOS/done-log-menubar"
INSTALLED_APP="/Applications/Daymark.app"
LEGACY_APP="/Applications/Done Log.app"

app_is_running() {
  pgrep -f -x "$1" >/dev/null
}

wait_for_app_exit() {
  local binary="$1"
  local attempt
  for ((attempt = 0; attempt < 20; attempt += 1)); do
    if ! app_is_running "$binary"; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

is_installed_done_log_identifier() {
  case "$1" in
    com.tonynguyen.donelog.menubar|com.tonynguyen.donelog|com.tonynguyen.donelog.macos)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

remove_installed_bundle() {
  local app_path="$1"
  local binary="$app_path/Contents/MacOS/done-log-menubar"

  if [[ -x "$binary" ]]; then
    "$binary" --unregister-login-item || true
  fi

  "$SOURCE_BINARY" --quit-running
  if ! wait_for_app_exit "$binary"; then
    while IFS= read -r running_pid; do
      if [[ "$running_pid" =~ ^[0-9]+$ ]]; then
        kill -TERM "$running_pid"
      fi
    done < <(pgrep -f -x "$binary")
  fi

  if ! wait_for_app_exit "$binary"; then
    echo "Daymark is still running; quit it and run the installer again" >&2
    exit 1
  fi

  rm -rf "$app_path"
}

replace_existing_app() {
  local app_path="$1"
  if [[ ! -e "$app_path" ]]; then
    return 0
  fi
  if [[ ! -d "$app_path" ]]; then
    echo "installation target is not an app directory: $app_path" >&2
    exit 1
  fi

  local installed_identifier
  installed_identifier="$(
    /usr/bin/plutil \
      -extract CFBundleIdentifier \
      raw \
      "$app_path/Contents/Info.plist"
  )"
  if ! is_installed_done_log_identifier "$installed_identifier"; then
    echo "refusing to replace an app with another bundle identifier" >&2
    exit 1
  fi

  local installed_version
  installed_version="$(
    /usr/bin/plutil \
      -extract CFBundleShortVersionString \
      raw \
      "$app_path/Contents/Info.plist"
  )"
  local version_status=0
  "$SCRIPT_DIR/app-version-is-newer.sh" \
    "$installed_version" \
    "$SOURCE_VERSION" \
    || version_status=$?
  if [[ "$version_status" -eq 0 ]]; then
    echo "refusing to replace newer Daymark $installed_version with $SOURCE_VERSION" >&2
    exit 1
  fi
  if [[ "$version_status" -ne 1 ]]; then
    echo "could not safely compare Daymark app versions" >&2
    exit 1
  fi

  remove_installed_bundle "$app_path"
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
if [[ "$SOURCE_IDENTIFIER" != "com.tonynguyen.donelog.menubar" ]]; then
  echo "refusing to install a development Daymark ($SOURCE_IDENTIFIER)" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_APP/Contents/Frameworks/Sparkle.framework" ]]; then
  echo "refusing to replace Daymark with a build that is missing Sparkle" >&2
  exit 1
fi

SOURCE_VERSION="$(
  /usr/bin/plutil \
    -extract CFBundleShortVersionString \
    raw \
    "$SOURCE_APP/Contents/Info.plist"
)"

if [[ ! -w "/Applications" ]]; then
  echo "/Applications is not writable for the current user" >&2
  echo "copy $SOURCE_APP to /Applications using Finder" >&2
  exit 1
fi

replace_existing_app "$INSTALLED_APP"
replace_existing_app "$LEGACY_APP"

/usr/bin/ditto "$SOURCE_APP" "$INSTALLED_APP"
/usr/bin/codesign --verify --deep --strict "$INSTALLED_APP"

echo "Daymark is installed at $INSTALLED_APP."
echo "Open it from Applications when you are ready."
