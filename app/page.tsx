/**
 * Main dashboard page.
 *
 * Fetches stats and results on load, renders the dashboard components.
 * "Refresh" starts a background analysis and the dashboard polls for completion.
 */

"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
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
  const previousIsRunningRef = useRef(false);

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

  useEffect(() => {
    const intervalMs = stats.analysisStatus?.isRunning ? 3000 : 15000;
    const intervalId = window.setInterval(() => {
      void fetchStats();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchStats, stats.analysisStatus?.isRunning]);

  useEffect(() => {
    const isRunning = stats.analysisStatus?.isRunning ?? false;
    if (previousIsRunningRef.current && !isRunning) {
      void fetchResults();
    }
    previousIsRunningRef.current = isRunning;
  }, [fetchResults, stats.analysisStatus?.isRunning]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (res.status === 202) {
        const data = await res.json();
        setStats((current) => ({
          ...current,
          analysisStatus: data.analysisStatus,
        }));
      } else {
        const data = await res.json();
        if (res.ok) {
          setStats(data);
        } else {
          await fetchStats();
        }
      }
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
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white">
              Dashboard
            </span>
            <Link
              href="/about"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              About the Model
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-center">
            March Madness 2026
          </h1>
          <p className="text-center text-gray-400 text-sm">
            Tracking 1 billion generated brackets against reality
          </p>
        </div>

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
