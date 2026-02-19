import { describe, expect, it } from "vitest";
import {
  getRunHistoryForActiveSession,
  getRunsForActiveSession
} from "./orchestrator-run-history.js";
import type { OrchestratorRunRecord } from "./state.js";

function createRunRecord(
  id: string,
  spaceId: string,
  sessionId: string,
  updatedAt: string,
  createdAt = "2026-02-16T00:00:00.000Z"
): OrchestratorRunRecord {
  return {
    id,
    spaceId,
    sessionId,
    prompt: `Prompt ${id}`,
    status: "completed",
    statusTimeline: ["queued", "running", "completed"],
    createdAt,
    updatedAt
  };
}

describe("orchestrator run history selectors", () => {
  it("returns only runs linked to the active space/session", () => {
    const runs = [
      createRunRecord("run-1", "space-1", "session-1", "2026-02-16T00:01:00.000Z"),
      createRunRecord("run-2", "space-1", "session-2", "2026-02-16T00:02:00.000Z"),
      createRunRecord("run-3", "space-2", "session-1", "2026-02-16T00:03:00.000Z"),
      createRunRecord("run-4", "space-1", "session-1", "2026-02-16T00:04:00.000Z")
    ];

    const selectedRuns = getRunsForActiveSession(runs, "space-1", "session-1");

    expect(selectedRuns.map((run) => run.id)).toEqual(["run-1", "run-4"]);
  });

  it("returns newest-first history without mutating source order", () => {
    const runsForSession = [
      createRunRecord("run-1", "space-1", "session-1", "2026-02-16T00:01:00.000Z"),
      createRunRecord("run-2", "space-1", "session-1", "2026-02-16T00:03:00.000Z"),
      createRunRecord("run-3", "space-1", "session-1", "2026-02-16T00:02:00.000Z")
    ];

    const runHistory = getRunHistoryForActiveSession(runsForSession);

    expect(runHistory.map((run) => run.id)).toEqual(["run-2", "run-3", "run-1"]);
    expect(runsForSession.map((run) => run.id)).toEqual(["run-1", "run-2", "run-3"]);
  });

  it("applies deterministic tie-breaks on updatedAt collisions", () => {
    const runsForSession = [
      createRunRecord("run-a", "space-1", "session-1", "2026-02-16T00:03:00.000Z", "2026-02-16T00:01:00.000Z"),
      createRunRecord("run-b", "space-1", "session-1", "2026-02-16T00:03:00.000Z", "2026-02-16T00:02:00.000Z"),
      createRunRecord("run-c", "space-1", "session-1", "2026-02-16T00:03:00.000Z", "2026-02-16T00:02:00.000Z")
    ];

    const runHistory = getRunHistoryForActiveSession(runsForSession);

    expect(runHistory.map((run) => run.id)).toEqual(["run-c", "run-b", "run-a"]);
  });
});
