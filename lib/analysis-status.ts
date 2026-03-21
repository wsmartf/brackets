import { getStats, setStats } from "./db";

export interface AnalysisStatus {
  isRunning: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  triggerSource: string | null;
}

const STATUS_KEY = "analysis_status";

const DEFAULT_STATUS: AnalysisStatus = {
  isRunning: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  triggerSource: null,
};

function readPersistedStatus(): AnalysisStatus {
  const raw = getStats(STATUS_KEY);
  if (!raw) {
    return DEFAULT_STATUS;
  }

  try {
    return {
      ...DEFAULT_STATUS,
      ...(JSON.parse(raw) as Partial<AnalysisStatus>),
    };
  } catch {
    return DEFAULT_STATUS;
  }
}

function writePersistedStatus(status: AnalysisStatus): void {
  setStats(STATUS_KEY, JSON.stringify(status));
}

function readLatestAnalyzedAt(): string | null {
  const raw = getStats("analysis");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { analyzedAt?: unknown };
    return typeof parsed.analyzedAt === "string" ? parsed.analyzedAt : null;
  } catch {
    return null;
  }
}

function reconcileStatus(status: AnalysisStatus): AnalysisStatus {
  if (!status.isRunning) {
    return status;
  }

  if (!status.lastStartedAt) {
    const repaired = { ...status, isRunning: false };
    writePersistedStatus(repaired);
    return repaired;
  }

  if (status.lastFinishedAt && status.lastFinishedAt >= status.lastStartedAt) {
    const repaired = { ...status, isRunning: false };
    writePersistedStatus(repaired);
    return repaired;
  }

  const analyzedAt = readLatestAnalyzedAt();
  if (analyzedAt && analyzedAt >= status.lastStartedAt) {
    const repaired = {
      ...status,
      isRunning: false,
      lastFinishedAt: status.lastFinishedAt ?? analyzedAt,
    };
    writePersistedStatus(repaired);
    return repaired;
  }

  return status;
}

export function getAnalysisStatus(): AnalysisStatus {
  return reconcileStatus(readPersistedStatus());
}

export function startAnalysisRun(triggerSource = "manual"): AnalysisStatus | null {
  const persisted = reconcileStatus(readPersistedStatus());
  if (persisted.isRunning) {
    return null;
  }

  const nextStatus: AnalysisStatus = {
    ...persisted,
    isRunning: true,
    lastStartedAt: new Date().toISOString(),
    lastError: null,
    triggerSource,
  };
  writePersistedStatus(nextStatus);

  return nextStatus;
}

export function finishAnalysisRun(error?: unknown): AnalysisStatus {
  const persisted = readPersistedStatus();
  const lastError =
    error instanceof Error ? error.message : error ? String(error) : null;
  const nextStatus: AnalysisStatus = {
    ...persisted,
    isRunning: false,
    lastFinishedAt: new Date().toISOString(),
    lastError,
  };
  writePersistedStatus(nextStatus);

  return nextStatus;
}
