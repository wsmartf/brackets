"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EliminationImpact } from "@/components/GameFeed";
import type { FutureKillerRow } from "@/lib/future-killers";
import type { BracketPickStatus, EliminatedByPick } from "@/lib/tournament";

export interface Stats {
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  analyzedAt: string | null;
  championshipProbs?: Record<string, number>;
  roundSurvivorCounts?: Record<string, number[]>;
  gamePickCounts?: Record<number, [number, number]>;
  indicesStored?: boolean;
  analysisStatus?: {
    isRunning: boolean;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastError: string | null;
    triggerSource: string | null;
  };
}

export interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
}

export interface Snapshot {
  id: number;
  remaining: number;
  gamesCompleted: number;
  championshipProbs: Record<string, number>;
  createdAt: string;
}

export interface SurvivorBracket {
  index: number;
  picks: BracketPickStatus[];
  alive: boolean;
  likelihood: number;
  championPick: string;
  championshipGame: [string, string];
  finalFour: string[];
  eliminatedBy: EliminatedByPick | null;
}

interface SnapshotsResponse {
  snapshots?: Snapshot[];
  eliminationImpact?: EliminationImpact[];
}

interface SurvivorsResponse {
  brackets?: SurvivorBracket[];
  total?: number;
}

interface FutureKillersResponse {
  rows?: FutureKillerRow[];
  source?: "espn" | "derived";
  isFallback?: boolean;
  note?: string | null;
}

export interface FinalNInsightMilestone {
  id: string;
  label: string;
  probability: number;
}

export interface FinalNInsights {
  bestCaseAfter: {
    label: string;
    remaining: number;
  } | null;
  milestones: FinalNInsightMilestone[];
}

export interface HomepageData {
  stats: Stats;
  results: GameResult[];
  impacts: EliminationImpact[];
  snapshots: Snapshot[];
  now: number;
  randomId: number;
  survivors: SurvivorBracket[] | null;
  futureKillers: FutureKillerRow[];
  futureKillersNote: string | null;
  futureKillersIsFallback: boolean;
  finalNInsights: FinalNInsights | null;
  isAnalysisRunning: boolean;
  gamesStarted: boolean;
  hasData: boolean;
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  eliminated: number;
  alivePercentage: string;
  biggestKill: number | null;
  latestGame: GameResult | null;
  latestGameImpact: EliminationImpact | null;
  latestGameLoser: string | null;
  latestGameRelativeTime: string | null;
  completedResults: GameResult[];
}

function parseTimestampMs(timestamp: string): number {
  const normalized = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T");
  const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  const parseable = hasTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(parseable).getTime();

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return new Date(timestamp).getTime();
}

function formatRelativeTime(timestamp: string, now: number): string {
  const then = parseTimestampMs(timestamp);
  if (!Number.isFinite(then)) {
    return "";
  }

  const elapsedMinutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (elapsedMinutes < 1) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function formatAlivePercentage(remaining: number, totalBrackets: number): string {
  if (totalBrackets <= 0) {
    return "0.0000%";
  }

  return `${((remaining / totalBrackets) * 100).toFixed(4)}%`;
}

export function useHomepageData(): HomepageData {
  const [stats, setStats] = useState<Stats>({
    remaining: 1_000_000_000,
    totalBrackets: 1_000_000_000,
    gamesCompleted: 0,
    analyzedAt: null,
  });
  const [results, setResults] = useState<GameResult[]>([]);
  const [impacts, setImpacts] = useState<EliminationImpact[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [randomId, setRandomId] = useState(0);
  const [survivors, setSurvivors] = useState<SurvivorBracket[] | null>(null);
  const [futureKillers, setFutureKillers] = useState<FutureKillerRow[]>([]);
  const [futureKillersNote, setFutureKillersNote] = useState<string | null>(null);
  const [futureKillersIsFallback, setFutureKillersIsFallback] = useState(false);
  const [finalNInsights, setFinalNInsights] = useState<FinalNInsights | null>(null);
  const previousIsRunningRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      setRandomId(Math.floor(Math.random() * 1_000_000_000));
    });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      setStats((await response.json()) as Stats);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch("/api/results", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      setResults((await response.json()) as GameResult[]);
    } catch (error) {
      console.error("Failed to fetch results:", error);
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const response = await fetch("/api/snapshots", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as SnapshotsResponse;
      if (data.eliminationImpact) {
        setImpacts(data.eliminationImpact);
      }
      if (Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots);
      }
    } catch (error) {
      console.error("Failed to fetch snapshots:", error);
    }
  }, []);

  const fetchSurvivors = useCallback(async () => {
    try {
      const response = await fetch("/api/survivors?detail=full", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as SurvivorsResponse;
      if (Array.isArray(data.brackets)) {
        setSurvivors(data.brackets);
      }
    } catch (error) {
      console.error("Failed to fetch survivors:", error);
    }
  }, []);

  const fetchFutureKillers = useCallback(async () => {
    try {
      const response = await fetch("/api/future-killers", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as FutureKillersResponse;
      setFutureKillers(Array.isArray(data.rows) ? data.rows : []);
      setFutureKillersNote(data.note ?? null);
      setFutureKillersIsFallback(Boolean(data.isFallback));
    } catch (error) {
      console.error("Failed to fetch future killers:", error);
    }
  }, []);

  const fetchFinalNInsights = useCallback(async () => {
    try {
      const response = await fetch("/api/final-n-insights", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      setFinalNInsights((await response.json()) as FinalNInsights);
    } catch (error) {
      console.error("Failed to fetch Final N insights:", error);
      setFinalNInsights(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchStats();
      void fetchResults();
      void fetchSnapshots();
    });
  }, [fetchResults, fetchSnapshots, fetchStats]);

  useEffect(() => {
    const intervalMs = stats.analysisStatus?.isRunning ? 3_000 : 15_000;
    const intervalId = window.setInterval(() => {
      void fetchStats();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchStats, stats.analysisStatus?.isRunning]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const isRunning = stats.analysisStatus?.isRunning ?? false;

    if (previousIsRunningRef.current && !isRunning) {
      queueMicrotask(() => {
        void fetchResults();
        void fetchSnapshots();
        if (stats.remaining <= 20) {
          void fetchSurvivors();
          void fetchFutureKillers();
        }
      });
    }

    previousIsRunningRef.current = isRunning;
  }, [
    fetchFutureKillers,
    fetchResults,
    fetchSnapshots,
    fetchSurvivors,
    stats.analysisStatus?.isRunning,
    stats.remaining,
  ]);

  useEffect(() => {
    if (stats.remaining > 20) {
      setSurvivors(null);
      setFutureKillers([]);
      setFutureKillersNote(null);
      setFutureKillersIsFallback(false);
      setFinalNInsights(null);
      return;
    }

    queueMicrotask(() => {
      void fetchSurvivors();
      void fetchFutureKillers();
      void fetchFinalNInsights();
    });

    const intervalId = window.setInterval(() => {
      void fetchFutureKillers();
      void fetchFinalNInsights();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchFinalNInsights, fetchFutureKillers, fetchSurvivors, stats.remaining]);

  const isAnalysisRunning = stats.analysisStatus?.isRunning ?? false;
  const gamesStarted = stats.gamesCompleted > 0;
  const hasData =
    Object.keys(stats.championshipProbs ?? {}).length > 0 || impacts.length > 0;

  const exactImpacts = impacts.filter(
    (impact) => impact.exact && impact.eliminated != null && impact.gameIndex != null
  );
  const completedResults = results
    .filter((result) => result.winner)
    .sort((a, b) => parseTimestampMs(b.updated_at) - parseTimestampMs(a.updated_at));
  const latestGame = completedResults[0] ?? null;

  const impactByGame = new Map<number, EliminationImpact>();
  for (const impact of impacts) {
    if (impact.gameIndex != null) {
      impactByGame.set(impact.gameIndex, impact);
    }
  }

  const latestGameImpact = latestGame
    ? impactByGame.get(latestGame.game_index) ?? null
    : null;
  const latestGameLoser =
    latestGame && latestGame.winner
      ? latestGame.winner === latestGame.team1
        ? latestGame.team2
        : latestGame.team1
      : null;
  const latestGameRelativeTime =
    latestGame ? formatRelativeTime(latestGame.updated_at, now) : null;

  const eliminated = stats.totalBrackets - stats.remaining;
  const alivePercentage = formatAlivePercentage(stats.remaining, stats.totalBrackets);
  const biggestKill =
    exactImpacts.length > 0
      ? Math.max(...exactImpacts.map((impact) => impact.eliminated ?? 0))
      : null;

  return {
    stats,
    results,
    impacts,
    snapshots,
    now,
    randomId,
    survivors,
    futureKillers,
    futureKillersNote,
    futureKillersIsFallback,
    finalNInsights,
    isAnalysisRunning,
    gamesStarted,
    hasData,
    remaining: stats.remaining,
    totalBrackets: stats.totalBrackets,
    gamesCompleted: stats.gamesCompleted,
    eliminated,
    alivePercentage,
    biggestKill,
    latestGame,
    latestGameImpact,
    latestGameLoser,
    latestGameRelativeTime,
    completedResults,
  };
}
