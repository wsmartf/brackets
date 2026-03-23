import { NextResponse } from "next/server";
import { getResults, getStats } from "@/lib/db";
import {
  extractScheduledTournamentGames,
  fetchScoreboard,
  getScoreboardCalendarDateKeys,
} from "@/lib/espn";
import {
  buildDerivedFutureKillerRows,
  buildScheduledFutureKillerRows,
  type GamePickCounts,
} from "@/lib/future-killers";

const MAX_ROWS = 5;
const MAX_SCOREBOARD_DAYS = 6;

interface AnalysisStatsPayload {
  gamePickCounts?: GamePickCounts;
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function GET() {
  const rawStats = getStats("analysis");
  const parsedStats = rawStats ? (JSON.parse(rawStats) as AnalysisStatsPayload) : {};
  const gamePickCounts = parsedStats.gamePickCounts;
  const results = getResults();

  if (!gamePickCounts) {
    return NextResponse.json({
      rows: [],
      source: "derived",
      isFallback: false,
      note: "Future killer data will appear after analysis runs with stored survivor indices.",
    });
  }

  const fallbackRows = buildDerivedFutureKillerRows(results, gamePickCounts).slice(0, MAX_ROWS);
  const todayKey = formatLocalDateKey(new Date());

  try {
    const initialScoreboard = await fetchScoreboard(todayKey);
    const calendarKeys = getScoreboardCalendarDateKeys(initialScoreboard)
      .filter((dateKey) => dateKey >= todayKey)
      .filter((dateKey, index, values) => values.indexOf(dateKey) === index);

    const dateKeys = [todayKey, ...calendarKeys.filter((dateKey) => dateKey !== todayKey)].slice(
      0,
      MAX_SCOREBOARD_DAYS
    );

    const scheduledGames = extractScheduledTournamentGames(initialScoreboard);
    let scheduledRows = buildScheduledFutureKillerRows(
      results,
      gamePickCounts,
      scheduledGames,
      MAX_ROWS
    );

    for (const dateKey of dateKeys.slice(1)) {
      if (scheduledRows.length >= MAX_ROWS) {
        break;
      }

      const scoreboard = await fetchScoreboard(dateKey);
      scheduledGames.push(...extractScheduledTournamentGames(scoreboard));
      scheduledRows = buildScheduledFutureKillerRows(results, gamePickCounts, scheduledGames, MAX_ROWS);
    }

    return NextResponse.json({
      rows: scheduledRows,
      source: "espn",
      isFallback: false,
      note:
        scheduledRows.length > 0
          ? null
          : "No upcoming scheduled tournament games with known participants yet.",
    });
  } catch (error) {
    console.error("Failed to load ESPN future killers schedule:", error);

    return NextResponse.json({
      rows: fallbackRows,
      source: "derived",
      isFallback: true,
      note:
        fallbackRows.length > 0
          ? "Live schedule unavailable. Showing known future matchups instead."
          : "No upcoming scheduled tournament games with known participants yet.",
    });
  }
}
