import { getStats, setStats } from "./db";

export interface AnalysisStatus {
  isRunning: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  triggerSource: string | null;
}

interface PersistedAnalysisStatus {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  triggerSource: string | null;
}

const STATUS_KEY = "analysis_status";

const DEFAULT_PERSISTED_STATUS: PersistedAnalysisStatus = {
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  triggerSource: null,
};

let activeRun: { startedAt: string; triggerSource: string } | null = null;

function readPersistedStatus(): PersistedAnalysisStatus {
  const raw = getStats(STATUS_KEY);
  if (!raw) {
    return DEFAULT_PERSISTED_STATUS;
  }

  try {
    return {
      ...DEFAULT_PERSISTED_STATUS,
      ...(JSON.parse(raw) as Partial<PersistedAnalysisStatus>),
    };
  } catch {
    return DEFAULT_PERSISTED_STATUS;
  }
}

function writePersistedStatus(status: PersistedAnalysisStatus): void {
  setStats(STATUS_KEY, JSON.stringify(status));
}

export function getAnalysisStatus(): AnalysisStatus {
  const persisted = readPersistedStatus();

  return {
    isRunning: activeRun !== null,
    lastStartedAt: activeRun?.startedAt ?? persisted.lastStartedAt,
    lastFinishedAt: persisted.lastFinishedAt,
    lastError: persisted.lastError,
    triggerSource: activeRun?.triggerSource ?? persisted.triggerSource,
  };
}

export function startAnalysisRun(triggerSource = "manual"): AnalysisStatus | null {
  if (activeRun) {
    return null;
  }

  const startedAt = new Date().toISOString();
  activeRun = { startedAt, triggerSource };

  const persisted = readPersistedStatus();
  writePersistedStatus({
    ...persisted,
    lastStartedAt: startedAt,
    lastError: null,
    triggerSource,
  });

  return getAnalysisStatus();
}

export function finishAnalysisRun(error?: unknown): AnalysisStatus {
  const persisted = readPersistedStatus();
  const lastError =
    error instanceof Error ? error.message : error ? String(error) : null;

  writePersistedStatus({
    ...persisted,
    lastFinishedAt: new Date().toISOString(),
    lastError,
    triggerSource: activeRun?.triggerSource ?? persisted.triggerSource,
  });

  activeRun = null;
  return getAnalysisStatus();
}
