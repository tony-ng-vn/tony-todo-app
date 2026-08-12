#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: app-version-is-newer.sh <candidate-version> <reference-version>" >&2
  exit 2
fi

CANDIDATE_VERSION="$1"
REFERENCE_VERSION="$2"

if [[ ! "$CANDIDATE_VERSION" =~ ^[0-9]+([.][0-9]+)*$ ]] \
  || [[ ! "$REFERENCE_VERSION" =~ ^[0-9]+([.][0-9]+)*$ ]]; then
  echo "app versions must contain only dot-separated numbers" >&2
  exit 2
fi

IFS=. read -r -a candidate_parts <<< "$CANDIDATE_VERSION"
IFS=. read -r -a reference_parts <<< "$REFERENCE_VERSION"

part_count="${#candidate_parts[@]}"
if (( ${#reference_parts[@]} > part_count )); then
  part_count="${#reference_parts[@]}"
fi

for ((index = 0; index < part_count; index += 1)); do
  candidate_part="${candidate_parts[index]:-0}"
  reference_part="${reference_parts[index]:-0}"

  if (( 10#$candidate_part > 10#$reference_part )); then
    exit 0
  fi
  if (( 10#$candidate_part < 10#$reference_part )); then
    exit 1
  fi
done

exit 1
