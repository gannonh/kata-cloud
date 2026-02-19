import { describe, expect, it } from "vitest";
import { normalizeAppState } from "./state";

describe("orchestrator run state normalization", () => {
  it("retains explicit run lifecycle statuses for valid runs", () => {
    const state = normalizeAppState({
      activeView: "orchestrator",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-16T00:00:00.000Z",
      spaces: [
        {
          id: "space-1",
          name: "Space 1",
          rootPath: "/tmp/space-1",
          description: "",
          tags: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "Session 1",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-1",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "Build a plan",
          status: "completed",
          statusTimeline: ["queued", "running", "completed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z",
          delegatedTasks: [
            {
              id: "run-1-verify",
              runId: "run-1",
              type: "verify",
              specialist: "verifier",
              status: "failed",
              statusTimeline: ["queued", "delegating", "failed"],
              createdAt: "2026-02-16T00:00:00.000Z",
              updatedAt: "2026-02-16T00:00:00.000Z",
              completedAt: "2026-02-16T00:00:00.000Z",
              errorMessage: "Delegation failed for verify."
            }
          ],
          draft: {
            runId: "run-1",
            generatedAt: "2026-02-16T00:00:00.000Z",
            content: "## Goal\nDraft goal"
          }
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(1);
    expect(state.orchestratorRuns[0]?.statusTimeline).toEqual(["queued", "running", "completed"]);
    expect(state.orchestratorRuns[0]?.draft?.runId).toBe("run-1");
    expect(state.orchestratorRuns[0]?.delegatedTasks?.[0]?.status).toBe("failed");
    expect(state.orchestratorRuns[0]?.delegatedTasks?.[0]?.statusTimeline).toEqual([
      "queued",
      "delegating",
      "failed"
    ]);
  });

  it("drops runs with unknown lifecycle states", () => {
    const state = normalizeAppState({
      activeView: "orchestrator",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-16T00:00:00.000Z",
      spaces: [
        {
          id: "space-1",
          name: "Space 1",
          rootPath: "/tmp/space-1",
          description: "",
          tags: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "Session 1",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-1",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "Build a plan",
          status: "completed",
          statusTimeline: ["queued", "running", "done"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z"
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(0);
  });

  it("drops runs with invalid draft artifacts", () => {
    const state = normalizeAppState({
      activeView: "orchestrator",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-16T00:00:00.000Z",
      spaces: [
        {
          id: "space-1",
          name: "Space 1",
          rootPath: "/tmp/space-1",
          description: "",
          tags: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "Session 1",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-1",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "Build a plan",
          status: "completed",
          statusTimeline: ["queued", "running", "completed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z",
          draft: {
            runId: "run-1",
            generatedAt: "",
            content: "## Goal\nDraft goal"
          }
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(0);
  });

  it("drops terminal runs without completedAt timestamp", () => {
    const state = normalizeAppState({
      activeView: "orchestrator",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-16T00:00:00.000Z",
      spaces: [
        {
          id: "space-1",
          name: "Space 1",
          rootPath: "/tmp/space-1",
          description: "",
          tags: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "Session 1",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-1",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "Build a plan",
          status: "completed",
          statusTimeline: ["queued", "running", "completed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(0);
  });
});
