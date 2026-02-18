import { describe, expect, it } from "vitest";
import {
  projectOrchestratorRunHistory,
  projectOrchestratorRunViewModel
} from "./orchestrator-run-view-model";
import type { OrchestratorRunRecord } from "./state";

function createRun(overrides: Partial<OrchestratorRunRecord> = {}): OrchestratorRunRecord {
  return {
    id: "run-1",
    spaceId: "space-1",
    sessionId: "session-1",
    prompt: "Draft deterministic status flow",
    status: "completed",
    statusTimeline: ["queued", "running", "completed"],
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:01:00.000Z",
    completedAt: "2026-02-18T00:01:00.000Z",
    ...overrides
  };
}

describe("orchestrator run view model projections", () => {
  it("projects stable defaults when delegated tasks are absent", () => {
    const projection = projectOrchestratorRunViewModel(createRun());

    expect(projection.statusLabel).toBe("Completed");
    expect(projection.lifecycleText).toBe("queued -> running -> completed");
    expect(projection.delegatedTasks).toEqual([]);
    expect(projection.errorMessage).toBeUndefined();
    expect(projection.contextPreview).toBe("No context snippets available.");
  });

  it("surfaces delegated failure diagnostics", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        status: "failed",
        statusTimeline: ["queued", "running", "failed"],
        errorMessage: "Run-level fallback failure.",
        delegatedTasks: [
          {
            id: "run-1-implement",
            runId: "run-1",
            type: "implement",
            specialist: "implementor",
            status: "completed",
            statusTimeline: ["queued", "delegating", "delegated", "running", "completed"],
            createdAt: "2026-02-18T00:00:00.000Z",
            updatedAt: "2026-02-18T00:00:10.000Z",
            completedAt: "2026-02-18T00:00:10.000Z"
          },
          {
            id: "run-1-verify",
            runId: "run-1",
            type: "verify",
            specialist: "verifier",
            status: "failed",
            statusTimeline: ["queued", "delegating", "failed"],
            createdAt: "2026-02-18T00:00:00.000Z",
            updatedAt: "2026-02-18T00:00:10.000Z",
            completedAt: "2026-02-18T00:00:10.000Z",
            errorMessage: "Delegation failed for verify."
          }
        ]
      })
    );

    expect(projection.status).toBe("failed");
    expect(projection.delegatedTasks).toHaveLength(2);
    expect(projection.delegatedTasks[1]?.lifecycleText).toBe("queued -> delegating -> failed");
    expect(projection.errorMessage).toBe("Delegation failed for verify.");
  });

  it("falls back to run-level failure message when tasks do not fail", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        status: "failed",
        statusTimeline: ["queued", "running", "failed"],
        errorMessage: "Context retrieval timed out.",
        delegatedTasks: [
          {
            id: "run-1-implement",
            runId: "run-1",
            type: "implement",
            specialist: "implementor",
            status: "completed",
            statusTimeline: ["queued", "delegating", "delegated", "running", "completed"],
            createdAt: "2026-02-18T00:00:00.000Z",
            updatedAt: "2026-02-18T00:00:10.000Z",
            completedAt: "2026-02-18T00:00:10.000Z"
          }
        ]
      })
    );

    expect(projection.errorMessage).toBe("Context retrieval timed out.");
  });

  it("produces deterministic context preview for empty and populated snippets", () => {
    const withoutSnippet = projectOrchestratorRunViewModel(
      createRun({
        contextSnippets: [
          {
            id: "snippet-empty",
            provider: "filesystem",
            source: "filesystem",
            path: "/tmp/project/notes.md",
            content: "   ",
            score: 0.4
          }
        ]
      })
    );
    expect(withoutSnippet.contextPreview).toBe("Context from /tmp/project/notes.md");

    const withSnippet = projectOrchestratorRunViewModel(
      createRun({
        contextSnippets: [
          {
            id: "snippet-full",
            provider: "filesystem",
            source: "filesystem",
            path: "/tmp/project/src/main.tsx",
            content: "Render deterministic run history.",
            score: 0.9
          }
        ]
      })
    );
    expect(withSnippet.contextPreview).toBe(
      "/tmp/project/src/main.tsx: Render deterministic run history."
    );
  });

  it("projects run history arrays without reordering", () => {
    const runHistory = projectOrchestratorRunHistory([
      createRun({ id: "run-a", prompt: "First" }),
      createRun({ id: "run-b", prompt: "Second" })
    ]);

    expect(runHistory.map((run) => run.id)).toEqual(["run-a", "run-b"]);
  });
});
