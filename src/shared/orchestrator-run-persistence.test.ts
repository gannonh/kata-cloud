import { describe, expect, it } from "vitest";
import {
  applyOrchestratorRunUpdate,
  completeOrchestratorRun,
  enqueueOrchestratorRun
} from "./orchestrator-run-persistence";
import type {
  OrchestratorDelegatedTaskRecord,
  OrchestratorRunRecord,
  OrchestratorSpecDraft
} from "./state";

function createRun(id: string, status: OrchestratorRunRecord["status"] = "queued"): OrchestratorRunRecord {
  const statusTimeline =
    status === "queued"
      ? ["queued"]
      : status === "running"
        ? ["queued", "running"]
        : ["queued", "running", status];
  return {
    id,
    spaceId: "space-1",
    sessionId: "session-1",
    prompt: `Prompt ${id}`,
    status,
    statusTimeline,
    createdAt: "2026-02-19T00:00:00.000Z",
    updatedAt: "2026-02-19T00:00:00.000Z",
    completedAt: status === "completed" || status === "failed" ? "2026-02-19T00:05:00.000Z" : undefined
  };
}

describe("orchestrator run persistence helpers", () => {
  it("enqueues a run immutably", () => {
    const runs = [createRun("run-1")];
    const queuedRun = createRun("run-2");

    const nextRuns = enqueueOrchestratorRun(runs, queuedRun);

    expect(nextRuns).toHaveLength(2);
    expect(nextRuns[1]?.id).toBe("run-2");
    expect(runs).toHaveLength(1);
  });

  it("updates an existing run by id", () => {
    const runs = [createRun("run-1"), createRun("run-2")];
    const runningRun = {
      ...runs[0],
      status: "running" as const,
      statusTimeline: ["queued", "running"],
      updatedAt: "2026-02-19T00:01:00.000Z"
    };

    const nextRuns = applyOrchestratorRunUpdate(runs, runningRun);

    expect(nextRuns).toHaveLength(2);
    expect(nextRuns[0]?.status).toBe("running");
    expect(nextRuns[0]?.updatedAt).toBe("2026-02-19T00:01:00.000Z");
    expect(nextRuns[1]?.id).toBe("run-2");
  });

  it("appends run update when id does not exist", () => {
    const runs = [createRun("run-1")];
    const newRun = createRun("run-3", "running");

    const nextRuns = applyOrchestratorRunUpdate(runs, newRun);

    expect(nextRuns).toHaveLength(2);
    expect(nextRuns[1]?.id).toBe("run-3");
  });

  it("completes a run with delegated outcomes and draft metadata", () => {
    const runs = [createRun("run-1", "completed"), createRun("run-2", "running")];
    const delegatedTasks: OrchestratorDelegatedTaskRecord[] = [
      {
        id: "run-1-implement",
        runId: "run-1",
        type: "implement",
        specialist: "implementor",
        status: "completed",
        statusTimeline: ["queued", "delegating", "delegated", "running", "completed"],
        createdAt: "2026-02-19T00:00:00.000Z",
        updatedAt: "2026-02-19T00:05:00.000Z",
        completedAt: "2026-02-19T00:05:00.000Z"
      }
    ];
    const draft: OrchestratorSpecDraft = {
      runId: "run-1",
      generatedAt: "2026-02-19T00:05:00.000Z",
      content: "## Goal\nPersist completion metadata"
    };

    const nextRuns = completeOrchestratorRun(runs, "run-1", {
      delegatedTasks,
      draft,
      contextSnippets: [
        {
          id: "snippet-1",
          provider: "filesystem",
          path: "/tmp/project/src/main.tsx",
          source: "filesystem",
          content: "orchestrator persistence",
          score: 0.7
        }
      ],
      draftAppliedAt: undefined,
      draftApplyError: undefined
    });

    expect(nextRuns[0]?.delegatedTasks).toHaveLength(1);
    expect(nextRuns[0]?.draft?.runId).toBe("run-1");
    expect(nextRuns[0]?.contextSnippets?.[0]?.id).toBe("snippet-1");
    expect(nextRuns[1]?.id).toBe("run-2");
  });
});

