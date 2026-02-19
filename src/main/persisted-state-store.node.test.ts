import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../shared/state";
import type { AppState, OrchestratorRunRecord } from "../shared/state";

let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => userDataPath)
  }
}));

import { PersistedStateStore } from "./persisted-state-store";

describe("PersistedStateStore.initialize", () => {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "kata-persisted-state-store-"));
  });

  afterEach(async () => {
    if (userDataPath) {
      await rm(userDataPath, { recursive: true, force: true });
    }
    userDataPath = "";
  });

  it("recovers queued and running runs as interrupted and writes recovered state", async () => {
    const baseState = createInitialAppState("2026-02-19T00:00:00.000Z");
    const spaceId = baseState.spaces[0].id;
    const sessionId = baseState.sessions[0].id;
    const queuedRun: OrchestratorRunRecord = {
      id: "run-queued",
      spaceId,
      sessionId,
      prompt: "Queued run",
      status: "queued",
      statusTimeline: ["queued"],
      createdAt: "2026-02-19T00:00:00.000Z",
      updatedAt: "2026-02-19T00:00:01.000Z"
    };
    const runningRun: OrchestratorRunRecord = {
      id: "run-running",
      spaceId,
      sessionId,
      prompt: "Running run",
      status: "running",
      statusTimeline: ["queued", "running"],
      createdAt: "2026-02-19T00:00:00.000Z",
      updatedAt: "2026-02-19T00:00:02.000Z"
    };
    const completedRun: OrchestratorRunRecord = {
      id: "run-completed",
      spaceId,
      sessionId,
      prompt: "Completed run",
      status: "completed",
      statusTimeline: ["queued", "running", "completed"],
      createdAt: "2026-02-19T00:00:00.000Z",
      updatedAt: "2026-02-19T00:00:03.000Z",
      completedAt: "2026-02-19T00:00:03.000Z"
    };
    const seededState: AppState = {
      ...baseState,
      orchestratorRuns: [queuedRun, runningRun, completedRun]
    };
    const statePath = path.join(userDataPath, "kata-cloud-state.json");
    await writeFile(statePath, JSON.stringify(seededState, null, 2), "utf8");

    const store = new PersistedStateStore();
    const initialized = await store.initialize();

    const recoveredQueued = initialized.orchestratorRuns.find((run) => run.id === queuedRun.id);
    const recoveredRunning = initialized.orchestratorRuns.find((run) => run.id === runningRun.id);
    const recoveredCompleted = initialized.orchestratorRuns.find((run) => run.id === completedRun.id);

    expect(recoveredQueued?.status).toBe("interrupted");
    expect(recoveredRunning?.status).toBe("interrupted");
    expect(recoveredQueued?.statusTimeline.at(-1)).toBe("interrupted");
    expect(recoveredRunning?.statusTimeline.at(-1)).toBe("interrupted");
    expect(Number.isNaN(Date.parse(recoveredQueued?.interruptedAt ?? ""))).toBe(false);
    expect(Number.isNaN(Date.parse(recoveredRunning?.interruptedAt ?? ""))).toBe(false);
    expect(recoveredQueued?.updatedAt).toBe(recoveredQueued?.interruptedAt);
    expect(recoveredRunning?.updatedAt).toBe(recoveredRunning?.interruptedAt);
    expect(recoveredCompleted?.status).toBe("completed");
    expect(recoveredCompleted?.completedAt).toBe("2026-02-19T00:00:03.000Z");

    const persistedRecovered = JSON.parse(await readFile(statePath, "utf8")) as AppState;
    expect(persistedRecovered.orchestratorRuns.find((run) => run.id === queuedRun.id)?.status).toBe(
      "interrupted"
    );
    expect(persistedRecovered.orchestratorRuns.find((run) => run.id === runningRun.id)?.status).toBe(
      "interrupted"
    );
  });
});
