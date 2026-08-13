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
SPARKLE_SOURCE="$BIN_DIRECTORY/Sparkle.framework"

if [[ ! -x "$BINARY" ]]; then
  echo "release binary is missing: $BINARY" >&2
  exit 1
fi
if [[ ! -d "$SPARKLE_SOURCE" ]]; then
  echo "Sparkle framework is missing: $SPARKLE_SOURCE" >&2
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
mkdir -p "$APP_BUNDLE/Contents/Frameworks"
/usr/bin/install -m 755 \
  "$BINARY" \
  "$APP_BUNDLE/Contents/MacOS/done-log-menubar"
/usr/bin/ditto \
  "$SPARKLE_SOURCE" \
  "$APP_BUNDLE/Contents/Frameworks/Sparkle.framework"
# Done Log is not sandboxed, so Sparkle does not use its optional XPC services.
rm -rf "$APP_BUNDLE/Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices"
/usr/bin/install_name_tool \
  -add_rpath '@executable_path/../Frameworks' \
  "$APP_BUNDLE/Contents/MacOS/done-log-menubar"
/usr/bin/install -m 644 \
  "$REPO_ROOT/native/App/Info.plist" \
  "$APP_BUNDLE/Contents/Info.plist"

if [[ -n "${DONE_LOG_BUNDLE_IDENTIFIER:-}" ]]; then
  /usr/bin/plutil -replace CFBundleIdentifier \
    -string "$DONE_LOG_BUNDLE_IDENTIFIER" \
    "$APP_BUNDLE/Contents/Info.plist"
fi
if [[ -n "${DONE_LOG_BUNDLE_DISPLAY_NAME:-}" ]]; then
  /usr/bin/plutil -replace CFBundleDisplayName \
    -string "$DONE_LOG_BUNDLE_DISPLAY_NAME" \
    "$APP_BUNDLE/Contents/Info.plist"
  /usr/bin/plutil -replace CFBundleName \
    -string "$DONE_LOG_BUNDLE_DISPLAY_NAME" \
    "$APP_BUNDLE/Contents/Info.plist"
fi

BUNDLE_IDENTIFIER="${DONE_LOG_BUNDLE_IDENTIFIER:-$(
  /usr/bin/plutil \
    -extract CFBundleIdentifier \
    raw \
    "$APP_BUNDLE/Contents/Info.plist"
)}"

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
SIGNING_OPTIONS=(--force --sign "$CODE_SIGN_IDENTITY")
if [[ "$CODE_SIGN_IDENTITY" != "-" ]]; then
  SIGNING_OPTIONS+=(--options runtime)
  if [[ "$CODE_SIGN_IDENTITY" == Developer\ ID\ Application:* ]]; then
    SIGNING_OPTIONS+=(--timestamp)
  fi
fi

SPARKLE_FRAMEWORK="$APP_BUNDLE/Contents/Frameworks/Sparkle.framework"
if [[ "$CODE_SIGN_IDENTITY" != "-" ]]; then
  /usr/bin/codesign "${SIGNING_OPTIONS[@]}" \
    "$SPARKLE_FRAMEWORK/Versions/B/Autoupdate"
  /usr/bin/codesign "${SIGNING_OPTIONS[@]}" \
    "$SPARKLE_FRAMEWORK/Versions/B/Updater.app"
  /usr/bin/codesign "${SIGNING_OPTIONS[@]}" "$SPARKLE_FRAMEWORK"
fi
/usr/bin/codesign "${SIGNING_OPTIONS[@]}" \
  --identifier "$BUNDLE_IDENTIFIER" \
  "$APP_BUNDLE"
/usr/bin/codesign --verify --deep --strict "$APP_BUNDLE"
/usr/bin/otool -l "$APP_BUNDLE/Contents/MacOS/done-log-menubar" \
  | grep -q '@executable_path/../Frameworks'

echo "$APP_BUNDLE"
