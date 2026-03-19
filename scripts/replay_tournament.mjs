import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import Database from "better-sqlite3";

const adminBaseUrl = (process.env.ADMIN_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const adminToken = process.env.ADMIN_TOKEN;
const stubBaseUrl = (process.env.ESPN_STUB_BASE_URL || "http://127.0.0.1:4100").replace(
  /\/$/,
  ""
);
const scenarioPath = resolve(
  process.env.ESPN_STUB_SCENARIO || "scripts/fixtures/replay-round64-smoke.json"
);
const replayStepDelayMs = parseIntegerEnv("REPLAY_STEP_DELAY_MS", 0);
const replayPollIntervalMs = parseIntegerEnv("REPLAY_POLL_INTERVAL_MS", 500);
const replayTimeoutMs = parseIntegerEnv("REPLAY_TIMEOUT_MS", 120000);
const databasePath = process.env.MARCH_MADNESS_DB_PATH?.trim() || null;

const defaultDatabasePath = join(process.cwd(), "march-madness.db");
const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
const scenarioEventsById = new Map(scenario.events.map((event) => [event.id, event]));

function parseIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function parseAuditEntry(entry) {
  try {
    return {
      ...entry,
      details: JSON.parse(entry.details),
    };
  } catch {
    return {
      ...entry,
      details: {},
    };
  }
}

function adminHeaders(extraHeaders = {}) {
  if (!adminToken) {
    fail("ADMIN_TOKEN is required");
  }

  return {
    Authorization: `Bearer ${adminToken}`,
    ...extraHeaders,
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function getStats() {
  return requestJson(`${adminBaseUrl}/api/stats`);
}

async function getResults() {
  return requestJson(`${adminBaseUrl}/api/results`);
}

async function getSnapshots() {
  return requestJson(`${adminBaseUrl}/api/snapshots`);
}

async function getAudit(limit = 200) {
  return requestJson(`${adminBaseUrl}/api/audit?limit=${limit}`, {
    headers: adminHeaders(),
  });
}

async function postRefresh() {
  return requestJson(`${adminBaseUrl}/api/refresh`, {
    method: "POST",
    headers: adminHeaders(),
  });
}

async function postManualResult(action) {
  return requestJson(`${adminBaseUrl}/api/results`, {
    method: "POST",
    headers: adminHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      game_index: action.gameIndex,
      round: action.round,
      team1: action.team1,
      team2: action.team2,
      winner: action.winner,
    }),
  });
}

async function getStubState() {
  return requestJson(`${stubBaseUrl}/admin/state`);
}

async function stubReset() {
  return requestJson(`${stubBaseUrl}/admin/reset`, {
    method: "POST",
  });
}

async function stubAdvance() {
  return requestJson(`${stubBaseUrl}/admin/step`, {
    method: "POST",
  });
}

async function stubFailure(mode) {
  return requestJson(`${stubBaseUrl}/admin/failure?mode=${encodeURIComponent(mode)}`, {
    method: "POST",
  });
}

function getPendingResultCount() {
  if (!databasePath || !existsSync(databasePath)) {
    return null;
  }

  const db = new Database(databasePath, { readonly: true });
  try {
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM result_events WHERE processed_at IS NULL")
      .get();
    return row?.count ?? 0;
  } finally {
    db.close();
  }
}

async function waitForRefreshCompletion(initialRunning) {
  const deadline = Date.now() + replayTimeoutMs;
  let sawRunning = initialRunning;
  let lastStats = null;

  while (Date.now() < deadline) {
    const response = await getStats();
    assert(response.ok, `/api/stats returned ${response.status}`);
    lastStats = response.body;

    if (response.body.analysisStatus?.isRunning) {
      sawRunning = true;
    }

    if (sawRunning && !response.body.analysisStatus?.isRunning) {
      return response.body;
    }

    await sleep(replayPollIntervalMs);
  }

  fail(
    `Timed out waiting for refresh completion after ${replayTimeoutMs}ms. Last stats: ${JSON.stringify(lastStats)}`
  );
}

async function collectState() {
  const [statsResponse, resultsResponse, snapshotsResponse, auditResponse] = await Promise.all([
    getStats(),
    getResults(),
    getSnapshots(),
    getAudit(),
  ]);

  assert(statsResponse.ok, `/api/stats returned ${statsResponse.status}`);
  assert(resultsResponse.ok, `/api/results returned ${resultsResponse.status}`);
  assert(snapshotsResponse.ok, `/api/snapshots returned ${snapshotsResponse.status}`);
  assert(auditResponse.ok, `/api/audit returned ${auditResponse.status}`);

  return {
    stats: statsResponse.body,
    results: resultsResponse.body,
    snapshots: snapshotsResponse.body.snapshots,
    eliminationImpact: snapshotsResponse.body.eliminationImpact,
    audit: auditResponse.body.map(parseAuditEntry),
  };
}

function filterNewAuditEntries(auditEntries, previousMaxId) {
  return auditEntries.filter((entry) => entry.id > previousMaxId);
}

function countAuditEntries(entries, action, predicate = () => true) {
  return entries.filter((entry) => entry.action === action && predicate(entry.details)).length;
}

function getVisibleEvents(visibleEventIds) {
  return visibleEventIds.map((eventId) => {
    const event = scenarioEventsById.get(eventId);
    assert(event, `Scenario event ${eventId} is missing`);
    return event;
  });
}

function buildExpectedWinners(step) {
  const expected = new Map();

  for (const event of getVisibleEvents(step.visibleEventIds)) {
    expected.set(event.gameIndex, event.winner);
  }

  for (const [gameIndex, winner] of Object.entries(step.expectedWinnerByGame || {})) {
    expected.set(Number.parseInt(gameIndex, 10), winner);
  }

  return expected;
}

async function runRefreshAndAssert({
  label,
  step,
  beforeState,
  previousRemaining,
  expectedQueuedCount,
  expectedProcessedCount = expectedQueuedCount,
  expectedSnapshotDelta = 1,
  expectManualOverrideSkip = false,
  concurrent = false,
}) {
  let refreshResponse;

  if (concurrent) {
    const [first, second] = await Promise.all([postRefresh(), postRefresh()]);
    const responses = [first, second].sort((left, right) => left.status - right.status);
    assert(
      responses[0].status === 202 && responses[1].status === 409,
      `${label}: expected refresh responses [202, 409], got [${responses[0].status}, ${responses[1].status}]`
    );
    refreshResponse = responses[0];
  } else {
    refreshResponse = await postRefresh();
    assert(refreshResponse.status === 202, `${label}: expected refresh 202, got ${refreshResponse.status}`);
  }

  const finalStats = await waitForRefreshCompletion(
    Boolean(refreshResponse.body?.analysisStatus?.isRunning)
  );
  const afterState = await collectState();
  const newAuditEntries = filterNewAuditEntries(afterState.audit, beforeState.maxAuditId);
  const pendingResultCount = getPendingResultCount();

  assert(
    countAuditEntries(newAuditEntries, "refresh_succeeded") >= 1,
    `${label}: missing refresh_succeeded audit entry`
  );

  assert(
    countAuditEntries(newAuditEntries, "espn_result_queued") === expectedQueuedCount,
    `${label}: expected ${expectedQueuedCount} espn_result_queued entries, saw ${countAuditEntries(
      newAuditEntries,
      "espn_result_queued"
    )}`
  );

  assert(
    countAuditEntries(newAuditEntries, "result_event_processed") === expectedProcessedCount,
    `${label}: expected ${expectedProcessedCount} result_event_processed entries, saw ${countAuditEntries(
      newAuditEntries,
      "result_event_processed"
    )}`
  );

  if (pendingResultCount !== null) {
    assert(pendingResultCount === 0, `${label}: expected 0 pending result events, saw ${pendingResultCount}`);
  }

  assert(
    finalStats.gamesCompleted === step.expectedGamesCompleted,
    `${label}: expected gamesCompleted=${step.expectedGamesCompleted}, saw ${finalStats.gamesCompleted}`
  );

  assert(
    afterState.snapshots.length >= beforeState.snapshotCount + expectedSnapshotDelta,
    `${label}: expected snapshot delta >= ${expectedSnapshotDelta}, saw ${
      afterState.snapshots.length - beforeState.snapshotCount
    }`
  );

  const latestSnapshot = afterState.snapshots[afterState.snapshots.length - 1];
  if (expectedSnapshotDelta > 0) {
    assert(latestSnapshot, `${label}: missing latest snapshot`);
    assert(
      JSON.stringify(latestSnapshot.newGameIndices) === JSON.stringify(step.expectedNewGameIndices),
      `${label}: expected latest snapshot newGameIndices=${JSON.stringify(
        step.expectedNewGameIndices
      )}, saw ${JSON.stringify(latestSnapshot.newGameIndices)}`
    );
  }

  if (previousRemaining !== null) {
    assert(
      finalStats.remaining <= previousRemaining,
      `${label}: remaining increased from ${previousRemaining} to ${finalStats.remaining}`
    );
  }

  const expectedWinners = buildExpectedWinners(step);
  const resultsByGame = new Map(afterState.results.map((result) => [result.game_index, result]));

  for (const [gameIndex, expectedWinner] of expectedWinners.entries()) {
    const result = resultsByGame.get(gameIndex);
    assert(result, `${label}: missing result row for game ${gameIndex}`);
    assert(
      result.winner === expectedWinner,
      `${label}: expected winner ${expectedWinner} for game ${gameIndex}, saw ${result.winner}`
    );
  }

  if (expectManualOverrideSkip) {
    assert(
      countAuditEntries(
        newAuditEntries,
        "espn_result_skipped",
        (details) => details.reason === "manual_override"
      ) >= 1,
      `${label}: missing espn_result_skipped(manual_override) audit entry`
    );
  }

  console.log(
    JSON.stringify(
      {
        label,
        gamesCompleted: finalStats.gamesCompleted,
        remaining: finalStats.remaining,
        queued: countAuditEntries(newAuditEntries, "espn_result_queued"),
        processed: countAuditEntries(newAuditEntries, "result_event_processed"),
        refreshSucceeded: countAuditEntries(newAuditEntries, "refresh_succeeded"),
        pendingResultCount,
        latestSnapshotNewGameIndices: latestSnapshot?.newGameIndices ?? null,
      },
      null,
      2
    )
  );

  return {
    remaining: finalStats.remaining,
    maxAuditId: afterState.audit[0]?.id ?? beforeState.maxAuditId,
    snapshotCount: afterState.snapshots.length,
  };
}

async function runStep(step, state, options = {}) {
  const label = `step ${step.step}: ${step.label}`;
  console.log(`\n== ${label} ==`);

  if (Array.isArray(step.preActions)) {
    for (const action of step.preActions) {
      if (action.type !== "manual_result") {
        fail(`${label}: unsupported preAction type ${action.type}`);
      }

      const response = await postManualResult(action);
      assert(response.ok, `${label}: manual result preAction failed with ${response.status}`);
      console.log(
        JSON.stringify(
          {
            label: `${label} preAction`,
            type: action.type,
            gameIndex: action.gameIndex,
            winner: action.winner,
          },
          null,
          2
        )
      );
    }
  }

  const stubResponse = await stubAdvance();
  assert(stubResponse.ok, `${label}: failed to advance stub`);

  if (replayStepDelayMs > 0) {
    console.log(`${label}: waiting ${replayStepDelayMs}ms before refresh`);
    await sleep(replayStepDelayMs);
  }

  const previousVisibleIds = new Set(state.visibleEventIds);
  const currentVisibleIds = new Set(stubResponse.body.visibleEventIds);
  const newlyVisibleEventIds = [...currentVisibleIds].filter((eventId) => !previousVisibleIds.has(eventId));
  assert(
    JSON.stringify(stubResponse.body.visibleEventIds) === JSON.stringify(step.visibleEventIds),
    `${label}: stub visibleEventIds mismatch. expected ${JSON.stringify(
      step.visibleEventIds
    )}, saw ${JSON.stringify(stubResponse.body.visibleEventIds)}`
  );

  const nextState = await runRefreshAndAssert({
    label,
    step,
    beforeState: state,
    previousRemaining: state.remaining,
    expectedQueuedCount: step.expectedQueuedCount ?? newlyVisibleEventIds.length,
    expectedProcessedCount: step.expectedProcessedCount ?? step.expectedQueuedCount ?? newlyVisibleEventIds.length,
    expectManualOverrideSkip: Boolean(step.preActions?.length),
    concurrent: options.concurrent ?? false,
  });

  return {
    ...state,
    ...nextState,
    visibleEventIds: stubResponse.body.visibleEventIds,
  };
}

async function runDuplicateCheck(state, step) {
  const label = `duplicate check after step ${step.step}`;
  console.log(`\n== ${label} ==`);

  const nextState = await runRefreshAndAssert({
    label,
    step,
    beforeState: state,
    previousRemaining: state.remaining,
    expectedQueuedCount: 0,
    expectedProcessedCount: 0,
    expectedSnapshotDelta: 0,
  });

  assert(
    nextState.remaining === state.remaining,
    `${label}: remaining changed from ${state.remaining} to ${nextState.remaining}`
  );

  return {
    ...state,
    ...nextState,
  };
}

async function runFailureCheck(state, step) {
  const label = "ESPN failure check";
  console.log(`\n== ${label} ==`);

  const failureResponse = await stubFailure("500");
  assert(failureResponse.ok, `${label}: failed to enable stub failure mode`);

  const beforeState = await collectState();
  const refreshResponse = await postRefresh();
  assert(refreshResponse.status === 202, `${label}: expected refresh 202, got ${refreshResponse.status}`);
  await waitForRefreshCompletion(Boolean(refreshResponse.body?.analysisStatus?.isRunning));
  const afterState = await collectState();
  const newAuditEntries = filterNewAuditEntries(afterState.audit, beforeState.audit[0]?.id ?? 0);

  assert(
    countAuditEntries(newAuditEntries, "espn_fetch_failed") >= 1,
    `${label}: missing espn_fetch_failed audit entry`
  );
  assert(
    countAuditEntries(newAuditEntries, "refresh_succeeded") >= 1,
    `${label}: missing refresh_succeeded after ESPN failure`
  );
  assert(
    afterState.stats.remaining === state.remaining,
    `${label}: remaining changed from ${state.remaining} to ${afterState.stats.remaining}`
  );
  assert(
    afterState.stats.gamesCompleted === step.expectedGamesCompleted,
    `${label}: gamesCompleted changed from ${step.expectedGamesCompleted} to ${afterState.stats.gamesCompleted}`
  );

  const clearFailureResponse = await stubFailure("none");
  assert(clearFailureResponse.ok, `${label}: failed to clear stub failure mode`);

  console.log(
    JSON.stringify(
      {
        label,
        remaining: afterState.stats.remaining,
        gamesCompleted: afterState.stats.gamesCompleted,
        espnFetchFailedCount: countAuditEntries(newAuditEntries, "espn_fetch_failed"),
      },
      null,
      2
    )
  );
}

async function main() {
  assert(
    databasePath && resolve(databasePath) !== resolve(defaultDatabasePath),
    `Refusing to run without an isolated MARCH_MADNESS_DB_PATH. Current value: ${databasePath ?? "<unset>"}`
  );

  const statsResponse = await getStats();
  assert(statsResponse.ok, `App is not reachable at ${adminBaseUrl}/api/stats`);

  const stubResetResponse = await stubReset();
  assert(stubResetResponse.ok, `Stub is not reachable at ${stubBaseUrl}/admin/reset`);

  const stubState = await getStubState();
  assert(stubState.ok, `Failed to read stub state from ${stubBaseUrl}/admin/state`);
  assert(
    JSON.stringify(stubState.body.visibleEventIds) === JSON.stringify(scenario.steps[0].visibleEventIds),
    `Stub initial visibleEventIds mismatch. expected ${JSON.stringify(
      scenario.steps[0].visibleEventIds
    )}, saw ${JSON.stringify(stubState.body.visibleEventIds)}`
  );

  const initialState = await collectState();
  assert(
    initialState.stats.gamesCompleted === 0,
    `Expected clean DB with gamesCompleted=0, saw ${initialState.stats.gamesCompleted}`
  );

  let state = {
    maxAuditId: initialState.audit[0]?.id ?? 0,
    snapshotCount: initialState.snapshots.length,
    remaining: initialState.stats.remaining,
    visibleEventIds: stubState.body.visibleEventIds,
  };

  console.log(
    JSON.stringify(
      {
        ok: true,
        scenario: scenario.scenario,
        adminBaseUrl,
        stubBaseUrl,
        databasePath,
        totalSteps: scenario.steps.length - 1,
      },
      null,
      2
    )
  );

  state = await runStep(scenario.steps[1], state, { concurrent: true });
  state = await runDuplicateCheck(state, scenario.steps[1]);

  for (const step of scenario.steps.slice(2)) {
    state = await runStep(step, state);
  }

  await runFailureCheck(state, scenario.steps[scenario.steps.length - 1]);

  console.log(
    `\nReplay passed: ${scenario.scenario}. Final remaining=${state.remaining}, gamesCompleted=${
      scenario.steps[scenario.steps.length - 1].expectedGamesCompleted
    }`
  );
}

main().catch((error) => {
  console.error(`\nReplay failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
