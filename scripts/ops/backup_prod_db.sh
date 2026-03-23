#!/usr/bin/env bash

set -euo pipefail

canonical_dir() {
  cd "$1" && pwd -P
}

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required" >&2
  exit 1
fi

PROD_DB_PATH="${PROD_DB_PATH:-march-madness.db}"
REHEARSAL_DB_PATH="${REHEARSAL_DB_PATH:-/tmp/brackets-prod-rehearsal.db}"
REHEARSAL_DB_OVERWRITE="${REHEARSAL_DB_OVERWRITE:-0}"

if [[ ! -f "$PROD_DB_PATH" ]]; then
  echo "Production DB not found: $PROD_DB_PATH" >&2
  exit 1
fi

PROD_DB_PATH="$(cd "$(dirname "$PROD_DB_PATH")" && pwd -P)/$(basename "$PROD_DB_PATH")"
REHEARSAL_DB_DIR="$(canonical_dir "$(dirname "$REHEARSAL_DB_PATH")")"
REHEARSAL_DB_PATH="$REHEARSAL_DB_DIR/$(basename "$REHEARSAL_DB_PATH")"

if [[ "$PROD_DB_PATH" == "$REHEARSAL_DB_PATH" ]]; then
  echo "Refusing to back up the production DB onto itself" >&2
  exit 1
fi

if [[ -e "$REHEARSAL_DB_PATH" ]]; then
  if [[ "$REHEARSAL_DB_OVERWRITE" == "1" ]]; then
    rm -f "$REHEARSAL_DB_PATH"
  else
    echo "Rehearsal DB already exists: $REHEARSAL_DB_PATH" >&2
    echo "Remove it, set REHEARSAL_DB_OVERWRITE=1, or choose a different REHEARSAL_DB_PATH." >&2
    exit 1
  fi
fi

# Use SQLite's backup API so the snapshot is consistent even when WAL is active.
sqlite3 "$PROD_DB_PATH" ".backup '$REHEARSAL_DB_PATH'"

cat <<EOF
Created rehearsal DB snapshot:
  $REHEARSAL_DB_PATH

Source DB:
  $PROD_DB_PATH
EOF
