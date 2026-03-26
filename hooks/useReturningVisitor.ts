"use client";

import { useEffect, useState } from "react";
import type { SurvivorBracket } from "@/hooks/useHomepageData";

const STORAGE_KEY = "brackets-visitor-state";

interface VisitorState {
  remaining: number;
  gamesCompleted: number;
  survivingIndices: number[];
  timestamp: number;
}

export interface ReturningVisitorResult {
  previousState: VisitorState | null;
  isReturning: boolean;
  eliminatedSince: number[];
  remainingDelta: number;
}

export function useReturningVisitor(
  currentRemaining: number,
  currentSurvivors: SurvivorBracket[] | null,
  currentGamesCompleted: number
): ReturningVisitorResult {
  const [previousState, setPreviousState] = useState<VisitorState | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreviousState(JSON.parse(stored) as VisitorState);
      }
    } catch {
      setPreviousState(null);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded || currentSurvivors == null) {
      return;
    }

    const state: VisitorState = {
      remaining: currentRemaining,
      gamesCompleted: currentGamesCompleted,
      survivingIndices: currentSurvivors.map((survivor) => survivor.index),
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage failures in private browsing or quota-restricted contexts.
    }
  }, [currentGamesCompleted, currentRemaining, currentSurvivors, hasLoaded]);

  const eliminatedSince = previousState
    ? previousState.survivingIndices.filter(
        (index) => !currentSurvivors?.some((survivor) => survivor.index === index)
      )
    : [];
  const remainingDelta = previousState
    ? Math.max(previousState.remaining - currentRemaining, 0)
    : 0;
  const isReturning =
    hasLoaded &&
    previousState != null &&
    (previousState.remaining !== currentRemaining ||
      previousState.gamesCompleted !== currentGamesCompleted);

  return {
    previousState,
    isReturning,
    eliminatedSince,
    remainingDelta,
  };
}
