"use client";

import { useState } from "react";
import ProbabilityBars from "./ProbabilityBars";
import KillerLeaderboard from "./KillerLeaderboard";
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
}

export default function AnalysisCardSwitcher({
  probs,
  remaining,
  impacts,
  results,
}: AnalysisCardSwitcherProps) {
  const [activeTab, setActiveTab] = useState<Tab>("survivors");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 flex flex-col">
      <div className="flex border-b border-white/10 overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium shrink-0 transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-white border-white"
                : "text-white/40 border-transparent hover:text-white/70"
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
          <div className="py-4">
            <p className="text-white/40 text-sm italic">
              Coming soon — search for your team to see how many surviving brackets have them winning.
            </p>
          </div>
        )}
        {activeTab === "future-killers" && (
          <div className="py-4">
            <p className="text-white/40 text-sm italic">
              Coming soon — see which upcoming games stand to eliminate the most brackets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
