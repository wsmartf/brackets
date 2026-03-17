/**
 * Dashboard — Main stats display.
 *
 * Shows:
 * - "X of 1,000,000,000 brackets remaining" (big hero number)
 * - Progress bar (games completed / 63)
 * - Refresh button with loading state
 * - Last analyzed timestamp
 *
 * Props:
 *   stats: { remaining, totalBrackets, gamesCompleted, analyzedAt }
 *   onRefresh: () => Promise<void>  — callback to trigger analysis
 *   isRefreshing: boolean
 */

"use client";

interface DashboardProps {
  stats: {
    remaining: number;
    totalBrackets: number;
    gamesCompleted: number;
    analyzedAt: string | null;
    analysisStatus?: {
      isRunning: boolean;
      lastStartedAt: string | null;
      lastFinishedAt: string | null;
      lastError: string | null;
      triggerSource: string | null;
    };
  };
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export default function Dashboard({ stats, onRefresh, isRefreshing }: DashboardProps) {
  const pctRemaining = ((stats.remaining / stats.totalBrackets) * 100).toFixed(4);
  const pctComplete = ((stats.gamesCompleted / 63) * 100).toFixed(0);
  const isAnalysisRunning = stats.analysisStatus?.isRunning ?? false;

  return (
    <div className="space-y-6">
      {/* Hero stat */}
      <div className="text-center py-8">
        <p className="text-sm uppercase tracking-wide text-gray-500 mb-1">
          Brackets Remaining
        </p>
        <p className="text-5xl font-bold text-white tabular-nums">
          {stats.remaining.toLocaleString()}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          of {stats.totalBrackets.toLocaleString()} generated ({pctRemaining}%)
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>Tournament Progress</span>
          <span>{stats.gamesCompleted}/63 games ({pctComplete}%)</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${pctComplete}%` }}
          />
        </div>
      </div>

      {/* Refresh button + timestamp */}
      <div className="flex items-start justify-between gap-4">
        <button
          onClick={onRefresh}
          disabled={isRefreshing || isAnalysisRunning}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors"
        >
          {isRefreshing || isAnalysisRunning ? "Analyzing..." : "Refresh Analysis"}
        </button>
        <div className="text-right text-xs text-gray-500 space-y-1">
          {isAnalysisRunning && stats.analysisStatus?.lastStartedAt && (
            <p>Analysis in progress since {new Date(stats.analysisStatus.lastStartedAt).toLocaleString()}</p>
          )}
          {stats.analyzedAt && (
            <p>Last updated: {new Date(stats.analyzedAt).toLocaleString()}</p>
          )}
          {stats.analysisStatus?.lastError && (
            <p className="text-red-400">Last refresh failed: {stats.analysisStatus.lastError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
