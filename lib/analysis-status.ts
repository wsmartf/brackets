import { getStats, setStats } from "./db";

export interface AnalysisStatus {
  isRunning: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  triggerSource: string | null;
}

interface PersistedAnalysisStatus {
  isRunning: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  triggerSource: string | null;
}

const STATUS_KEY = "analysis_status";

const DEFAULT_PERSISTED_STATUS: PersistedAnalysisStatus = {
  isRunning: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
  triggerSource: null,
};

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

function toStatus(status: PersistedAnalysisStatus): AnalysisStatus {
  return {
    isRunning: status.isRunning,
    lastStartedAt: status.lastStartedAt,
    lastFinishedAt: status.lastFinishedAt,
    lastError: status.lastError,
    triggerSource: status.triggerSource,
  };
}

function reconcileStatus(status: PersistedAnalysisStatus): PersistedAnalysisStatus {
  if (!status.isRunning) {
    return status;
  }

  if (!status.lastStartedAt) {
    const repaired = {
      ...status,
      isRunning: false,
    };
    writePersistedStatus(repaired);
    return repaired;
  }

  if (status.lastFinishedAt && status.lastFinishedAt >= status.lastStartedAt) {
    const repaired = {
      ...status,
      isRunning: false,
    };
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
  const persisted = reconcileStatus(readPersistedStatus());

  return toStatus(persisted);
}

export function startAnalysisRun(triggerSource = "manual"): AnalysisStatus | null {
  const persisted = reconcileStatus(readPersistedStatus());
  if (persisted.isRunning) {
    return null;
  }

  const startedAt = new Date().toISOString();
  const nextStatus: PersistedAnalysisStatus = {
    ...persisted,
    isRunning: true,
    lastStartedAt: startedAt,
    lastError: null,
    triggerSource,
  };
  writePersistedStatus(nextStatus);

  return toStatus(nextStatus);
}

export function finishAnalysisRun(error?: unknown): AnalysisStatus {
  const persisted = readPersistedStatus();
  const lastError =
    error instanceof Error ? error.message : error ? String(error) : null;
  const nextStatus: PersistedAnalysisStatus = {
    ...persisted,
    isRunning: false,
    lastFinishedAt: new Date().toISOString(),
    lastError,
  };
  writePersistedStatus(nextStatus);

  return toStatus(nextStatus);
}
