import {
  clearFinalDisplayCohort,
  getFinalDisplayCohort,
  getSurvivorCount,
  getSurvivorIndices,
  setFinalDisplayCohort,
  type FinalDisplayCohort,
} from "./db";

export const FINAL_DISPLAY_THRESHOLD = 5;

export function syncFinalDisplayCohort(
  remaining: number,
  survivorIndices: number[],
  options: {
    threshold?: number;
    frozenAt?: string;
  } = {}
): FinalDisplayCohort | null {
  const threshold = options.threshold ?? FINAL_DISPLAY_THRESHOLD;

  if (remaining > threshold) {
    clearFinalDisplayCohort();
    return null;
  }

  const existing = getFinalDisplayCohort();
  if (existing && existing.threshold === threshold) {
    return existing;
  }

  if (survivorIndices.length === 0) {
    return existing;
  }

  const cohort: FinalDisplayCohort = {
    threshold,
    indices: [...survivorIndices].sort((left, right) => left - right),
    frozenAt: options.frozenAt ?? new Date().toISOString(),
  };
  setFinalDisplayCohort(cohort);
  return cohort;
}

export function resolveFinalDisplayIndices(
  remaining: number,
  currentSurvivorIndices: number[],
  threshold = FINAL_DISPLAY_THRESHOLD
): number[] {
  if (remaining > threshold) {
    return currentSurvivorIndices;
  }

  const cohort = getFinalDisplayCohort();
  if (cohort && cohort.threshold === threshold && cohort.indices.length > 0) {
    return cohort.indices;
  }

  return currentSurvivorIndices;
}

export function syncFinalDisplayCohortFromCurrentSurvivors(
  threshold = FINAL_DISPLAY_THRESHOLD
): FinalDisplayCohort | null {
  const remaining = getSurvivorCount();
  const survivorIndices =
    remaining > 0 ? getSurvivorIndices({ limit: remaining, offset: 0 }) : [];

  return syncFinalDisplayCohort(remaining, survivorIndices, { threshold });
}
