import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));

const host = process.env.ESPN_STUB_HOST || "127.0.0.1";
const port = Number.parseInt(process.env.ESPN_STUB_PORT || "4100", 10);
const scenarioPath = resolve(
  process.env.ESPN_STUB_SCENARIO || join(scriptDir, "fixtures", "replay-round64-smoke.json")
);

const scenario = JSON.parse(readFileSync(scenarioPath, "utf8"));
const eventsById = new Map(scenario.events.map((event) => [event.id, event]));

let currentStep = 0;
let failureMode = "none";

function inferStatusType(statusName) {
  switch (statusName) {
    case "STATUS_SCHEDULED":
      return { name: statusName, state: "pre", completed: false };
    case "STATUS_IN_PROGRESS":
    case "STATUS_HALFTIME":
      return { name: statusName, state: "in", completed: false };
    case "STATUS_FINAL":
    default:
      return { name: statusName || "STATUS_FINAL", state: "post", completed: true };
  }
}

function getStepState() {
  const step = scenario.steps[currentStep] ?? scenario.steps[scenario.steps.length - 1];
  return {
    currentStep,
    label: step?.label ?? null,
    visibleEventIds: step?.visibleEventIds ?? [],
    failureMode,
    scenario: scenario.scenario,
    totalSteps: scenario.steps.length,
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendMalformed(response) {
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end('{"events":');
}

function scoreboardDateString(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}

function buildScoreboardEvent(event) {
  const statusType = inferStatusType(event.status || "STATUS_FINAL");
  return {
    id: event.id,
    date: event.date,
    name: `${event.team1} vs ${event.team2}`,
    status: {
      type: statusType,
    },
    competitions: [
      {
        type: {
          abbreviation: "TRNMNT",
        },
        startDate: event.date,
        competitors: [
          {
            team: {
              displayName: event.team1,
              shortDisplayName: event.team1,
              abbreviation: event.team1.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase(),
            },
            score: String(event.score1),
            winner: event.winner === event.team1,
            curatedRank:
              typeof event.seed1 === "number"
                ? {
                    current: event.seed1,
                  }
                : undefined,
          },
          {
            team: {
              displayName: event.team2,
              shortDisplayName: event.team2,
              abbreviation: event.team2.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase(),
            },
            score: String(event.score2),
            winner: event.winner === event.team2,
            curatedRank:
              typeof event.seed2 === "number"
                ? {
                    current: event.seed2,
                  }
                : undefined,
          },
        ],
      },
    ],
  };
}

function parseJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }

      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on("error", rejectBody);
  });
}

function buildLeagueCalendar() {
  if (Array.isArray(scenario.calendarDates) && scenario.calendarDates.length > 0) {
    return scenario.calendarDates;
  }

  const visibleEvents = getStepState().visibleEventIds
    .map((eventId) => eventsById.get(eventId))
    .filter(Boolean);

  return [...new Set(visibleEvents.map((event) => `${event.date.slice(0, 10)}T07:00Z`))];
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === "GET" && url.pathname === "/admin/state") {
    sendJson(response, 200, getStepState());
    return;
  }

  if (request.method === "POST" && url.pathname === "/admin/reset") {
    currentStep = 0;
    failureMode = "none";
    sendJson(response, 200, getStepState());
    return;
  }

  if (request.method === "POST" && url.pathname === "/admin/step") {
    currentStep = Math.min(currentStep + 1, scenario.steps.length - 1);
    sendJson(response, 200, getStepState());
    return;
  }

  if (request.method === "POST" && url.pathname === "/admin/failure") {
    let mode = url.searchParams.get("mode");

    if (!mode) {
      try {
        const body = await parseJsonBody(request);
        mode = typeof body.mode === "string" ? body.mode : null;
      } catch {
        sendJson(response, 400, { error: "Expected valid JSON body" });
        return;
      }
    }

    if (!mode || !["none", "500", "malformed"].includes(mode)) {
      sendJson(response, 400, { error: "mode must be one of: none, 500, malformed" });
      return;
    }

    failureMode = mode;
    sendJson(response, 200, getStepState());
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
  ) {
    if (failureMode === "500") {
      sendJson(response, 500, { error: "Stubbed scoreboard failure" });
      return;
    }

    if (failureMode === "malformed") {
      sendMalformed(response);
      return;
    }

    const requestedDates = new Set(
      (url.searchParams.get("dates") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    const { visibleEventIds } = getStepState();
    const events = visibleEventIds
      .map((eventId) => eventsById.get(eventId))
      .filter(Boolean)
      .filter((event) => {
        if (scenario.ignoreRequestedDates) {
          return true;
        }
        if (requestedDates.size === 0) {
          return true;
        }
        return requestedDates.has(scoreboardDateString(event.date));
      })
      .map((event) => buildScoreboardEvent(event));

    sendJson(response, 200, {
      events,
      leagues: [
        {
          calendar: buildLeagueCalendar(),
        },
      ],
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, host, () => {
  const scoreboardBaseUrl = `http://${host}:${port}/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`;
  console.log(
    JSON.stringify(
      {
        ok: true,
        scenario: scenario.scenario,
        scoreboardBaseUrl,
        adminBaseUrl: `http://${host}:${port}/admin`,
        state: getStepState(),
      },
      null,
      2
    )
  );
});
