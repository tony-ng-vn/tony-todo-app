#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
PACKAGE_FILE="$REPO_ROOT/native/Package.swift"

REQUIRED_MAJOR="$(sed -n 's#// swift-tools-version: \([0-9][0-9]*\).*#\1#p' "$PACKAGE_FILE" | head -n 1)"
INSTALLED_VERSION="$(swift --version)"
INSTALLED_MAJOR="$(printf '%s\n' "$INSTALLED_VERSION" | sed -n 's/.*Swift version \([0-9][0-9]*\).*/\1/p' | head -n 1)"

if [[ -z "$REQUIRED_MAJOR" || -z "$INSTALLED_MAJOR" ]]; then
  echo "unable to compare Package.swift with the installed Swift toolchain" >&2
  printf '%s\n' "$INSTALLED_VERSION" >&2
  exit 1
fi

if (( INSTALLED_MAJOR < REQUIRED_MAJOR )); then
  echo "Swift $REQUIRED_MAJOR or newer is required, but Swift $INSTALLED_MAJOR is installed" >&2
  exit 1
fi

printf 'Swift toolchain satisfies package requirement: installed %s, required %s+\n' "$INSTALLED_MAJOR" "$REQUIRED_MAJOR"
