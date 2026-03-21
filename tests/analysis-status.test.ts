import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "./test-helpers";
import { initDb } from "../lib/db";
import {
  getAnalysisStatus,
  startAnalysisRun,
  finishAnalysisRun,
} from "../lib/analysis-status";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => cleanup());

describe("analysis status state machine", () => {
  test("initial status: not running, no timestamps", () => {
    const status = getAnalysisStatus();
    expect(status.isRunning).toBe(false);
    expect(status.lastStartedAt).toBeNull();
    expect(status.lastFinishedAt).toBeNull();
    expect(status.lastError).toBeNull();
    expect(status.triggerSource).toBeNull();
  });

  test("startAnalysisRun marks as running with triggerSource", () => {
    const status = startAnalysisRun("espn_poll");
    expect(status?.isRunning).toBe(true);
    expect(status?.triggerSource).toBe("espn_poll");
    expect(status?.lastStartedAt).not.toBeNull();
  });

  test("startAnalysisRun returns null when already running", () => {
    startAnalysisRun("first");
    expect(startAnalysisRun("second")).toBeNull();
  });

  test("getAnalysisStatus reflects running state", () => {
    startAnalysisRun("manual");
    expect(getAnalysisStatus().isRunning).toBe(true);
  });

  test("finishAnalysisRun clears running flag and records completion", () => {
    startAnalysisRun("manual");
    const status = finishAnalysisRun();
    expect(status.isRunning).toBe(false);
    expect(status.lastFinishedAt).not.toBeNull();
    expect(status.lastError).toBeNull();
  });

  test("finishAnalysisRun with Error records the message", () => {
    startAnalysisRun("manual");
    const status = finishAnalysisRun(new Error("worker crashed"));
    expect(status.lastError).toBe("worker crashed");
    expect(status.isRunning).toBe(false);
  });

  test("finishAnalysisRun with non-Error records string representation", () => {
    startAnalysisRun("manual");
    const status = finishAnalysisRun("something bad happened");
    expect(status.lastError).toBe("something bad happened");
  });

  test("after finish, a new run can be started", () => {
    startAnalysisRun("first");
    finishAnalysisRun();
    const second = startAnalysisRun("second");
    expect(second).not.toBeNull();
    expect(second?.isRunning).toBe(true);
  });
});
