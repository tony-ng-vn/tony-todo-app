#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
BUILD_ROOT="$REPO_ROOT/.build/app-bundle"
APP_BUNDLE="$BUILD_ROOT/Done Log.app"

swift build \
  --package-path "$REPO_ROOT/native" \
  -c release \
  --product done-log-menubar

BIN_DIRECTORY="$(
  swift build \
    --package-path "$REPO_ROOT/native" \
    -c release \
    --show-bin-path
)"
BINARY="$BIN_DIRECTORY/done-log-menubar"

if [[ ! -x "$BINARY" ]]; then
  echo "release binary is missing: $BINARY" >&2
  exit 1
fi

mkdir -p "$BUILD_ROOT"
CANONICAL_BUILD_ROOT="$(cd "$BUILD_ROOT" && pwd -P)"
if [[ "$(dirname "$APP_BUNDLE")" != "$CANONICAL_BUILD_ROOT" ]] \
  || [[ "$(basename "$APP_BUNDLE")" != "Done Log.app" ]]; then
  echo "refusing to replace unexpected app path: $APP_BUNDLE" >&2
  exit 1
fi

if [[ -e "$APP_BUNDLE" ]]; then
  rm -rf "$APP_BUNDLE"
fi

mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"
/usr/bin/install -m 755 \
  "$BINARY" \
  "$APP_BUNDLE/Contents/MacOS/done-log-menubar"
/usr/bin/install -m 644 \
  "$REPO_ROOT/native/App/Info.plist" \
  "$APP_BUNDLE/Contents/Info.plist"

ICON_TEMP_DIRECTORY="$(
  mktemp -d "${TMPDIR:-/tmp}/done-log-icon.XXXXXX"
)"
trap 'rm -rf "$ICON_TEMP_DIRECTORY"' EXIT
ICONSET="$ICON_TEMP_DIRECTORY/AppIcon.iconset"
swift "$REPO_ROOT/native/App/generate-app-icon.swift" "$ICONSET"
/usr/bin/iconutil \
  --convert icns \
  --output "$APP_BUNDLE/Contents/Resources/AppIcon.icns" \
  "$ICONSET"

CODE_SIGN_IDENTITY="${DONE_LOG_CODESIGN_IDENTITY:-}"
if [[ -z "$CODE_SIGN_IDENTITY" ]]; then
  CODE_SIGN_IDENTITY="$(
    security find-identity -v -p codesigning 2>/dev/null \
      | awk '/^[[:space:]]*[0-9]+\)/ { print $2; exit }'
  )"
fi
if [[ -z "$CODE_SIGN_IDENTITY" ]]; then
  CODE_SIGN_IDENTITY="-"
fi

/usr/bin/plutil -lint "$APP_BUNDLE/Contents/Info.plist" >/dev/null
/usr/bin/codesign \
  --force \
  --deep \
  --sign "$CODE_SIGN_IDENTITY" \
  --identifier com.tonynguyen.donelog \
  "$APP_BUNDLE"
/usr/bin/codesign --verify --deep --strict "$APP_BUNDLE"

echo "$APP_BUNDLE"
