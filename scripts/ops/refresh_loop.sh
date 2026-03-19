#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${ADMIN_BASE_URL:-}" ]]; then
  echo "ADMIN_BASE_URL is required" >&2
  exit 1
fi

if [[ -z "${ADMIN_TOKEN:-}" ]]; then
  echo "ADMIN_TOKEN is required" >&2
  exit 1
fi

REFRESH_INTERVAL_SECONDS="${REFRESH_INTERVAL_SECONDS:-60}"
REFRESH_URL="${REFRESH_URL:-${ADMIN_BASE_URL%/}/api/refresh}"
CURL_BIN="${CURL_BIN:-curl}"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S %Z"
}

cleanup() {
  if [[ -n "${RESPONSE_FILE:-}" && -f "${RESPONSE_FILE}" ]]; then
    rm -f "${RESPONSE_FILE}"
  fi
}

trap cleanup EXIT
trap 'echo "[$(timestamp)] stopping refresh loop"; exit 0' INT TERM

echo "[$(timestamp)] starting refresh loop"
echo "[$(timestamp)] refresh url: ${REFRESH_URL}"
echo "[$(timestamp)] interval: ${REFRESH_INTERVAL_SECONDS}s"

while true; do
  RESPONSE_FILE="$(mktemp)"

  HTTP_STATUS="$("$CURL_BIN" -sS \
    -o "$RESPONSE_FILE" \
    -w "%{http_code}" \
    -X POST "$REFRESH_URL" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")"

  RESPONSE_BODY="$(cat "$RESPONSE_FILE")"
  rm -f "$RESPONSE_FILE"
  RESPONSE_FILE=""

  case "$HTTP_STATUS" in
    200)
      echo "[$(timestamp)] refresh noop: no new results"
      ;;
    202)
      echo "[$(timestamp)] refresh accepted"
      ;;
    409)
      echo "[$(timestamp)] refresh skipped: analysis already running"
      ;;
    401|403)
      echo "[$(timestamp)] refresh auth failed (${HTTP_STATUS}): ${RESPONSE_BODY}" >&2
      ;;
    *)
      echo "[$(timestamp)] refresh returned ${HTTP_STATUS}: ${RESPONSE_BODY}" >&2
      ;;
  esac

  sleep "$REFRESH_INTERVAL_SECONDS"
done
