"use client";

import { useState } from "react";
import ProbabilityBars from "./ProbabilityBars";
import KillerLeaderboard from "./KillerLeaderboard";
import MyTeamTab from "./MyTeamTab";
import FutureKillersTab from "./FutureKillersTab";
import type { EliminationImpact } from "./GameFeed";

type Tab = "survivors" | "killers" | "my-team" | "future-killers";

const TABS: { id: Tab; label: string }[] = [
  { id: "survivors", label: "Survivors" },
  { id: "killers", label: "Killers" },
  { id: "my-team", label: "My Team" },
  { id: "future-killers", label: "Future Killers" },
];

interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
}

interface AnalysisCardSwitcherProps {
  probs: Record<string, number>;
  remaining: number;
  impacts: EliminationImpact[];
  results: GameResult[];
  roundSurvivorCounts?: Record<string, number[]>;
  snapshots: Array<{
    id: number;
    remaining: number;
    gamesCompleted: number;
    championshipProbs: Record<string, number>;
    createdAt: string;
  }>;
}

export default function AnalysisCardSwitcher({
  probs,
  remaining,
  impacts,
  results,
  roundSurvivorCounts,
  snapshots,
}: AnalysisCardSwitcherProps) {
  const [activeTab, setActiveTab] = useState<Tab>("my-team");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 flex flex-col">
      <div className="flex border-b border-white/10 overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3.5 text-[15px] font-semibold tracking-tight shrink-0 transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-white border-white bg-white/[0.03]"
                : "text-white/55 border-transparent hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === "survivors" && (
          <ProbabilityBars probs={probs} remaining={remaining} />
        )}
        {activeTab === "killers" && (
          <KillerLeaderboard impacts={impacts} results={results} />
        )}
        {activeTab === "my-team" && (
          <MyTeamTab
            probs={probs}
            remaining={remaining}
            roundSurvivorCounts={roundSurvivorCounts}
            snapshots={snapshots}
          />
        )}
        {activeTab === "future-killers" && (
          <FutureKillersTab />
        )}
      </div>
    </div>
  );
}
