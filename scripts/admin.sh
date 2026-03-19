#!/usr/bin/env bash

set -euo pipefail

DEFAULT_BASE_URL="http://localhost:3000"
BASE_URL="${ADMIN_BASE_URL:-$DEFAULT_BASE_URL}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/admin.sh status
  bash scripts/admin.sh refresh
  bash scripts/admin.sh refresh-no-espn
  bash scripts/admin.sh audit [limit]
  bash scripts/admin.sh result set <game_index> <round> <team1> <team2> <winner>
  bash scripts/admin.sh result clear <game_index> <round> <team1> <team2>

Environment:
  ADMIN_BASE_URL   Defaults to http://127.0.0.1:3000
  ADMIN_TOKEN      Required for refresh, audit, and result commands
EOF
}

require_token() {
  if [[ -z "${ADMIN_TOKEN:-}" ]]; then
    echo "ADMIN_TOKEN is required" >&2
    exit 1
  fi
}

request() {
  local method="$1"
  local path="$2"
  local auth_mode="$3"
  local body="${4:-}"
  local response_file
  response_file="$(mktemp)"

  local -a curl_args=(
    -sS
    -o "$response_file"
    -w "%{http_code}"
    -X "$method"
    "${BASE_URL%/}${path}"
  )

  if [[ "$auth_mode" == "auth" ]]; then
    require_token
    curl_args+=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
  fi

  if [[ -n "$body" ]]; then
    curl_args+=(
      -H "Content-Type: application/json"
      --data "$body"
    )
  fi

  RESPONSE_STATUS="$(curl "${curl_args[@]}")"
  RESPONSE_BODY="$(cat "$response_file")"
  rm -f "$response_file"
}

print_json() {
  local status="$1"
  local body="$2"
  RESPONSE_STATUS="$status" RESPONSE_BODY="$body" node -e '
    const status = Number(process.env.RESPONSE_STATUS);
    const body = process.env.RESPONSE_BODY ?? "";

    console.log(`HTTP ${status}`);

    try {
      const parsed = JSON.parse(body);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(body);
    }
  '
}

status_command() {
  request GET "/api/stats" "none"

  RESPONSE_STATUS="$RESPONSE_STATUS" RESPONSE_BODY="$RESPONSE_BODY" ADMIN_BASE_URL="$BASE_URL" node -e '
    const status = Number(process.env.RESPONSE_STATUS);
    const body = process.env.RESPONSE_BODY ?? "";
    const baseUrl = process.env.ADMIN_BASE_URL ?? "";

    if (status !== 200) {
      console.error(`GET ${baseUrl}/api/stats failed with HTTP ${status}`);
      console.error(body);
      process.exit(1);
    }

    const parsed = JSON.parse(body);
    const analysisStatus = parsed.analysisStatus ?? {};

    console.log(`base_url: ${baseUrl}`);
    console.log(`remaining: ${parsed.remaining}`);
    console.log(`games_completed: ${parsed.gamesCompleted}`);
    console.log(`analyzed_at: ${parsed.analyzedAt ?? "null"}`);
    console.log(`analysis_running: ${analysisStatus.isRunning === true ? "yes" : "no"}`);
    console.log(`analysis_started_at: ${analysisStatus.lastStartedAt ?? "null"}`);
    console.log(`analysis_finished_at: ${analysisStatus.lastFinishedAt ?? "null"}`);
    console.log(`analysis_error: ${analysisStatus.lastError ?? "null"}`);
  '
}

refresh_command() {
  local path="$1"
  request POST "$path" "auth"
  print_json "$RESPONSE_STATUS" "$RESPONSE_BODY"
}

audit_command() {
  local limit="${1:-20}"
  request GET "/api/audit?limit=${limit}" "auth"

  RESPONSE_STATUS="$RESPONSE_STATUS" RESPONSE_BODY="$RESPONSE_BODY" node -e '
    const status = Number(process.env.RESPONSE_STATUS);
    const body = process.env.RESPONSE_BODY ?? "";

    if (status !== 200) {
      console.error(`GET /api/audit failed with HTTP ${status}`);
      console.error(body);
      process.exit(1);
    }

    const entries = JSON.parse(body);
    if (!Array.isArray(entries) || entries.length === 0) {
      console.log("No audit entries.");
      process.exit(0);
    }

    for (const entry of entries) {
      let details = entry.details;
      try {
        details = JSON.parse(entry.details);
      } catch {
        // Keep the raw details string if it is not valid JSON.
      }

      console.log(`#${entry.id} ${entry.created_at} ${entry.action}`);
      if (details !== undefined) {
        console.log(JSON.stringify(details, null, 2));
      }
      console.log("");
    }
  '
}

result_command() {
  local action="${1:-}"
  local game_index="${2:-}"
  local round="${3:-}"
  local team1="${4:-}"
  local team2="${5:-}"
  local winner="${6:-}"

  if [[ -z "$game_index" || -z "$round" || -z "$team1" || -z "$team2" ]]; then
    usage
    exit 1
  fi

  if [[ "$action" == "set" ]]; then
    if [[ -z "$winner" ]]; then
      usage
      exit 1
    fi
  elif [[ "$action" != "clear" ]]; then
    usage
    exit 1
  fi

  local body
  body="$(
    ACTION="$action" node -e '
      const [gameIndex, round, team1, team2, winnerArg] = process.argv.slice(1);
      const winner = process.env.ACTION === "clear" ? null : winnerArg;

      console.log(JSON.stringify({
        game_index: Number(gameIndex),
        round: Number(round),
        team1,
        team2,
        winner,
      }));
    ' "$game_index" "$round" "$team1" "$team2" "$winner"
  )"

  request POST "/api/results" "auth" "$body"
  print_json "$RESPONSE_STATUS" "$RESPONSE_BODY"
}

command="${1:-}"
case "$command" in
  status)
    status_command
    ;;
  refresh)
    refresh_command "/api/refresh"
    ;;
  refresh-no-espn)
    refresh_command "/api/refresh?espn=false"
    ;;
  audit)
    audit_command "${2:-20}"
    ;;
  result)
    shift
    result_command "$@"
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
