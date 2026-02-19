import { describe, expect, it } from "vitest";
import type { OrchestratorRunViewModel } from "../../shared/orchestrator-run-view-model.js";
import type { OrchestratorRunRecord } from "../../shared/state.js";
import { projectCoordinatorShellViewModel } from "./view-model.js";

function createRunViewModel(overrides: Partial<OrchestratorRunViewModel> = {}): OrchestratorRunViewModel {
  return {
    id: "run-1",
    prompt: "Build a robust coordinator shell",
    status: "running",
    statusLabel: "Running",
    lifecycleText: "queued -> running",
    contextPreview: "No context snippets available.",
    delegatedTasks: [],
    ...overrides
  };
}

function createRunRecord(overrides: Partial<OrchestratorRunRecord> = {}): OrchestratorRunRecord {
  return {
    id: "run-1",
    spaceId: "space-1",
    sessionId: "session-1",
    prompt: "Build a robust coordinator shell",
    status: "running",
    statusTimeline: ["queued", "running"],
    createdAt: "2026-02-19T12:00:00.000Z",
    updatedAt: "2026-02-19T12:00:10.000Z",
    ...overrides
  };
}

describe("projectCoordinatorShellViewModel", () => {
  it("returns deterministic defaults when there is no run history", () => {
    const projection = projectCoordinatorShellViewModel({
      activeSpace: {
        id: "space-1",
        name: "Kata Cloud",
        rootPath: "/tmp/kata",
        description: "",
        tags: [],
        createdAt: "2026-02-19T00:00:00.000Z",
        updatedAt: "2026-02-19T00:00:00.000Z"
      },
      activeSession: {
        id: "session-1",
        spaceId: "space-1",
        label: "Session 1",
        createdAt: "2026-02-19T00:00:00.000Z",
        updatedAt: "2026-02-19T00:00:00.000Z"
      },
      priorRunHistoryViewModels: [],
      specContent: "## Goal\nDescribe the project outcome.\n\n## Tasks\n- [ ] Add initial tasks",
      now: new Date("2026-02-19T12:00:00.000Z")
    });

    expect(projection.shellTitle).toBe("Kata Cloud");
    expect(projection.shellSubtitle).toBe("Session 1");
    expect(projection.latestRunStatus).toBe("none");
    expect(projection.latestEntries).toEqual([]);
    expect(projection.historicalEntries).toEqual([]);
    expect(projection.sidebarAgents[0]?.name).toBe("Coordinator");
    expect(projection.sidebarContext[0]?.label).toBe("Spec");
    expect(projection.workflowSteps[0]?.status).toBe("active");
    expect(projection.workflowSteps[1]?.status).toBe("pending");
  });

  it("projects prompt/status details and context chips for the latest run", () => {
    const latestRunViewModel = createRunViewModel({
      status: "failed",
      statusLabel: "Failed",
      lifecycleText: "queued -> running -> failed",
      errorMessage: "Deterministic failure triggered by keyword \"fail\". Remove \"fail\" and retry."
    });
    const latestRunRecord = createRunRecord({
      status: "failed",
      statusTimeline: ["queued", "running", "failed"],
      prompt: [
        "Line 1",
        "Line 2",
        "Line 3",
        "Line 4",
        "Line 5",
        "Line 6",
        "Line 7",
        "Line 8"
      ].join("\n"),
      contextSnippets: [
        {
          id: "snippet-1",
          provider: "filesystem",
          source: "filesystem",
          path: "/tmp/kata/docs/spec.md",
          content: "spec context",
          score: 0.9
        }
      ]
    });

    const projection = projectCoordinatorShellViewModel({
      activeSpace: {
        id: "space-1",
        name: "Kata Cloud",
        rootPath: "/tmp/kata",
        description: "",
        tags: [],
        createdAt: "2026-02-19T00:00:00.000Z",
        updatedAt: "2026-02-19T00:00:00.000Z"
      },
      activeSession: {
        id: "session-1",
        spaceId: "space-1",
        label: "Session 1",
        createdAt: "2026-02-19T00:00:00.000Z",
        updatedAt: "2026-02-19T00:00:00.000Z"
      },
      latestRunRecord,
      latestRunViewModel,
      priorRunHistoryViewModels: [],
      specContent: "## Goal\nWorking draft",
      now: new Date("2026-02-19T12:05:00.000Z")
    });

    expect(projection.latestEntries).toHaveLength(2);
    expect(projection.latestEntries[0]?.pastedLineCount).toBe(8);
    expect(projection.latestEntries[1]?.content).toContain("Run run-1 is Failed.");
    expect(projection.latestEntries[1]?.content).toContain(
      "Deterministic failure triggered by keyword \"fail\""
    );
    expect(projection.latestEntries[1]?.contextChips[0]?.label).toBe("spec.md");
    expect(projection.sidebarAgents[0]?.status).toBe("error");
  });

  it("derives workflow state from run completion and spec readiness", () => {
    const projection = projectCoordinatorShellViewModel({
      latestRunRecord: createRunRecord({
        status: "completed",
        statusTimeline: ["queued", "running", "completed"],
        draftAppliedAt: "2026-02-19T12:02:00.000Z"
      }),
      latestRunViewModel: createRunViewModel({
        status: "completed",
        statusLabel: "Completed",
        lifecycleText: "queued -> running -> completed",
        delegatedTasks: [
          {
            id: "task-1",
            type: "implement",
            specialist: "implementor",
            status: "completed",
            lifecycleText: "Queued -> Delegating -> Running -> Completed"
          }
        ]
      }),
      priorRunHistoryViewModels: [
        createRunViewModel({
          id: "run-0",
          status: "failed",
          statusLabel: "Failed",
          lifecycleText: "queued -> running -> failed",
          errorMessage: "Historical failure"
        })
      ],
      specContent: "## Goal\nShip coordinator shell",
      now: new Date("2026-02-19T12:10:00.000Z")
    });

    expect(projection.workflowSteps[0]?.status).toBe("complete");
    expect(projection.workflowSteps[1]?.status).toBe("complete");
    expect(projection.workflowSteps[2]?.status).toBe("active");
    expect(projection.historicalEntries[0]?.authorLabel).toBe("Run History");
    expect(projection.historicalEntries[0]?.content).toContain("Historical failure");
  });
});
