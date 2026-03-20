import * as espn from "../../lib/espn.ts";
const espnApi = espn.default ?? espn;

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function getAuditDates() {
  const explicitDates = (process.env.ESPN_AUDIT_DATES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (explicitDates.length > 0) {
    return [...new Set(explicitDates)];
  }

  const daysBack = Math.max(parseIntegerEnv("ESPN_AUDIT_DAYS_BACK", 0), 0);
  const daysAhead = Math.max(parseIntegerEnv("ESPN_AUDIT_DAYS_AHEAD", 0), 0);
  const today = new Date();
  const dates = [];

  for (let offset = -daysBack; offset <= daysAhead; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    dates.push(formatDate(date));
  }

  return dates;
}

function getTournamentCompetitors(scoreboard) {
  const competitors = [];

  for (const event of scoreboard.events ?? []) {
    const competition = event.competitions?.[0];
    if (competition?.type?.abbreviation !== "TRNMNT") {
      continue;
    }

    for (const competitor of competition.competitors ?? []) {
      competitors.push({
        eventId: event.id,
        eventDate: event.date,
        status: event.status?.type?.name ?? null,
        displayName: competitor.team.displayName,
        shortDisplayName: competitor.team.shortDisplayName ?? competitor.team.displayName,
        abbreviation: competitor.team.abbreviation,
      });
    }
  }

  return competitors;
}

function pad(value, width) {
  return String(value).padEnd(width, " ");
}

async function main() {
  const dates = getAuditDates();
  const scoreboards = await Promise.all(dates.map((date) => espnApi.fetchScoreboard(date)));
  const allCompetitors = scoreboards.flatMap((scoreboard) => getTournamentCompetitors(scoreboard));

  const uniqueByShortName = new Map();
  for (const competitor of allCompetitors) {
    if (!uniqueByShortName.has(competitor.shortDisplayName)) {
      uniqueByShortName.set(competitor.shortDisplayName, competitor);
    }
  }

  const rows = [...uniqueByShortName.values()]
    .map((competitor) => ({
      ...competitor,
      mappedTo: espnApi.mapEspnTeamName(competitor.shortDisplayName),
    }))
    .sort((left, right) => left.shortDisplayName.localeCompare(right.shortDisplayName));

  const unmatched = rows.filter((row) => row.mappedTo === null);

  console.log(`dates: ${dates.join(", ")}`);
  console.log(`teams_seen: ${rows.length}`);
  console.log(`unmatched_names: ${unmatched.length}`);
  console.log("");

  if (rows.length > 0) {
    const header =
      `${pad("status", 14)} ${pad("espn_name", 24)} ${pad("display_name", 24)} ` +
      `${pad("abbr", 8)} mapped_to`;
    console.log(header);
    console.log("-".repeat(header.length));

    for (const row of rows) {
      console.log(
        `${pad(row.status ?? "-", 14)} ${pad(row.shortDisplayName, 24)} ${pad(
          row.displayName,
          24
        )} ${pad(row.abbreviation, 8)} ${row.mappedTo ?? "UNMATCHED"}`
      );
    }
  }

  if (unmatched.length > 0) {
    console.error("");
    console.error("Unmatched ESPN names:");
    for (const row of unmatched) {
      console.error(
        `- ${row.shortDisplayName} (display=${row.displayName}, abbr=${row.abbreviation}, event=${row.eventId}, date=${row.eventDate})`
      );
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
