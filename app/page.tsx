/**
 * Main dashboard page.
 *
 * Fetches stats and results on load, renders the dashboard components.
 * "Refresh" button triggers a full analysis (may take 2-3 min for 1B brackets).
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import Dashboard from "@/components/Dashboard";
import ProbabilityBars from "@/components/ProbabilityBars";
import GameFeed from "@/components/GameFeed";

interface Stats {
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  analyzedAt: string | null;
  championshipProbs?: Record<string, number>;
  analysisStatus?: {
    isRunning: boolean;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastError: string | null;
    triggerSource: string | null;
  };
}

interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    remaining: 1_000_000_000,
    totalBrackets: 1_000_000_000,
    gamesCompleted: 0,
    analyzedAt: null,
  });
  const [results, setResults] = useState<GameResult[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/results");
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Failed to fetch results:", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchResults();
  }, [fetchStats, fetchResults]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        await fetchStats();
      }
      await fetchResults();
    } catch (err) {
      console.error("Failed to refresh:", err);
      await fetchStats();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-center">
          March Madness 2026
        </h1>
        <p className="text-center text-gray-400 text-sm">
          Tracking 1 billion generated brackets against reality
        </p>

        <Dashboard
          stats={stats}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <ProbabilityBars probs={stats.championshipProbs ?? {}} />

        <GameFeed results={results} />
      </div>
    </main>
  );
}
