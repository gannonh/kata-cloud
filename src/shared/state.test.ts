import { describe, expect, it } from "vitest";
import {
  APP_STATE_VERSION,
  createInitialAppState,
  normalizeAppState
} from "./state";

describe("shared state helpers", () => {
  it("creates deterministic initial app state", () => {
    const now = "2026-02-16T00:00:00.000Z";
    const state = createInitialAppState(now);

    expect(state.version).toBe(APP_STATE_VERSION);
    expect(state.activeView).toBe("orchestrator");
    expect(state.activeSpaceId).toBe("space-getting-started");
    expect(state.activeSessionId).toBe("session-getting-started");
    expect(state.lastOpenedAt).toBe(now);
    expect(state.spaces).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.orchestratorRuns).toHaveLength(0);
    expect(state.spaces[0]?.createdAt).toBe(now);
    expect(state.spaces[0]?.contextProvider).toBe("filesystem");
    expect(state.sessions[0]?.createdAt).toBe(now);
  });

  it("returns fallback state for non-object input", () => {
    const state = normalizeAppState(null);

    expect(state.version).toBe(APP_STATE_VERSION);
    expect(state.activeView).toBe("orchestrator");
    expect(state.spaces).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.orchestratorRuns).toHaveLength(0);
    expect(state.activeSpaceId).toBe(state.spaces[0]?.id);
    expect(state.activeSessionId).toBe(state.sessions[0]?.id);
  });

  it("normalizes records and filters invalid spaces and sessions", () => {
    const validSpace = {
      id: "space-1",
      name: "Space 1",
      rootPath: "/tmp/space-1",
      description: "desc",
      tags: ["one", "two"],
      contextProvider: "mcp",
      repoUrl: "https://github.com/example/repo",
      gitStatus: {
        spaceId: "space-1",
        repoPath: "/tmp/space-1",
        branchName: "kata-space/space-1",
        worktreePath: "/tmp/space-1-worktrees/space-1",
        phase: "ready",
        message: "ready",
        remediation: null,
        updatedAt: "2026-02-16T00:00:00.000Z"
      },
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    };

    const state = normalizeAppState({
      activeView: "changes",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-16T00:00:00.000Z",
      spaces: [
        validSpace,
        {
          id: "",
          name: "bad",
          rootPath: "/tmp/bad",
          description: "bad",
          tags: ["bad"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "space-2",
          name: "Space 2",
          rootPath: "/tmp/space-2",
          description: "desc",
          tags: ["ok"],
          gitStatus: {
            phase: "unknown"
          },
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "linked",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "session-2",
          spaceId: "missing-space",
          label: "orphan",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "",
          spaceId: "space-1",
          label: "invalid",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-1",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "Draft a rollout plan",
          status: "completed",
          statusTimeline: ["queued", "running", "completed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z",
          contextSnippets: [
            {
              id: "filesystem:/tmp/space-1/src/main.tsx",
              provider: "filesystem",
              path: "/tmp/space-1/src/main.tsx",
              source: "filesystem",
              content: "draft a rollout plan",
              score: 1
            }
          ],
          delegatedTasks: [
            {
              id: "run-1-implement",
              runId: "run-1",
              type: "implement",
              specialist: "implementor",
              status: "completed",
              statusTimeline: ["queued", "delegating", "delegated", "running", "completed"],
              createdAt: "2026-02-16T00:00:00.000Z",
              updatedAt: "2026-02-16T00:00:00.000Z",
              completedAt: "2026-02-16T00:00:00.000Z"
            }
          ]
        },
        {
          id: "run-5",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "Investigate orchestrator failure mode",
          status: "failed",
          statusTimeline: ["queued", "running", "failed"],
          createdAt: "2026-02-16T00:05:00.000Z",
          updatedAt: "2026-02-16T00:06:00.000Z",
          completedAt: "2026-02-16T00:06:00.000Z",
          errorMessage: "Synthetic failure for testing",
          delegatedTasks: [
            {
              id: "run-5-verify",
              runId: "run-5",
              type: "verify",
              specialist: "verifier",
              status: "failed",
              statusTimeline: ["queued", "delegating", "delegated", "running", "failed"],
              createdAt: "2026-02-16T00:05:00.000Z",
              updatedAt: "2026-02-16T00:06:00.000Z",
              completedAt: "2026-02-16T00:06:00.000Z",
              errorMessage: "Verifier failure details"
            }
          ]
        },
        {
          id: "run-2",
          spaceId: "missing-space",
          sessionId: "session-1",
          prompt: "orphan",
          status: "queued",
          statusTimeline: ["queued"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "run-3",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "invalid",
          status: "completed",
          statusTimeline: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "run-4",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "recoverable nested payload",
          status: "completed",
          statusTimeline: ["queued", "running", "completed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z",
          contextSnippets: [
            {
              id: "broken-snippet",
              provider: "filesystem",
              path: "/tmp/space-1/src/main.tsx",
              source: "filesystem",
              content: "valid context payload",
              score: 0.8
            },
            {
              id: "invalid-snippet",
              provider: "filesystem",
              path: "/tmp/space-1/src/invalid.tsx",
              source: "filesystem",
              content: null,
              score: "nope"
            }
          ],
          delegatedTasks: [
            {
              id: "run-4-plan",
              runId: "run-4",
              type: "plan",
              specialist: "planner",
              status: "completed",
              statusTimeline: ["queued", "completed"],
              createdAt: "2026-02-16T00:00:00.000Z",
              updatedAt: "2026-02-16T00:00:00.000Z"
            }
          ]
        }
      ]
    });

    expect(state.activeView).toBe("changes");
    expect(state.activeSpaceId).toBe("space-1");
    expect(state.activeSessionId).toBe("session-1");
    expect(state.lastOpenedAt).toBe("2026-02-16T00:00:00.000Z");
    expect(state.spaces).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.orchestratorRuns).toHaveLength(3);
    expect(state.spaces[0]?.id).toBe("space-1");
    expect(state.spaces[0]?.contextProvider).toBe("mcp");
    expect(state.sessions[0]?.id).toBe("session-1");
    expect(state.orchestratorRuns[0]?.id).toBe("run-1");
    expect(state.orchestratorRuns[0]?.delegatedTasks).toHaveLength(1);
    expect(state.orchestratorRuns[0]?.delegatedTasks?.[0]?.specialist).toBe("implementor");
    expect(state.orchestratorRuns[1]?.id).toBe("run-5");
    expect(state.orchestratorRuns[1]?.status).toBe("failed");
    expect(state.orchestratorRuns[1]?.delegatedTasks?.[0]?.status).toBe("failed");
    expect(state.orchestratorRuns[2]?.id).toBe("run-4");
    expect(state.orchestratorRuns[2]?.delegatedTasks).toEqual([]);
    expect(state.orchestratorRuns[2]?.contextSnippets).toHaveLength(1);
    expect(state.orchestratorRuns[2]?.contextSnippets?.[0]?.id).toBe("broken-snippet");
  });

  it("falls back when active ids and view are invalid", () => {
    const state = normalizeAppState({
      activeView: "invalid",
      activeSpaceId: "missing-space",
      activeSessionId: "missing-session",
      lastOpenedAt: "",
      spaces: [
        {
          id: "space-a",
          name: "Space A",
          rootPath: "/tmp/space-a",
          description: "A",
          tags: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "space-b",
          name: "Space B",
          rootPath: "/tmp/space-b",
          description: "B",
          tags: [],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-b",
          spaceId: "space-b",
          label: "B",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        },
        {
          id: "session-a",
          spaceId: "space-a",
          label: "A",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeView).toBe("orchestrator");
    expect(state.activeSpaceId).toBe("space-a");
    expect(state.activeSessionId).toBe("session-a");
    expect(state.lastOpenedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("keeps browser as a valid active view", () => {
    const state = normalizeAppState({
      activeView: "browser"
    });

    expect(state.activeView).toBe("browser");
  });

  it("normalizes context retrieval errors with strict code validation", () => {
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
          id: "run-valid",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "valid context retrieval error code",
          status: "failed",
          statusTimeline: ["queued", "running", "failed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z",
          contextRetrievalError: {
            code: "io_failure",
            message: "Could not read context files.",
            remediation: "Retry and inspect filesystem permissions.",
            retryable: true,
            providerId: "filesystem"
          }
        },
        {
          id: "run-invalid",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "invalid context retrieval error code",
          status: "failed",
          statusTimeline: ["queued", "running", "failed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z",
          contextRetrievalError: {
            code: "",
            message: "Could not read context files.",
            remediation: "Retry and inspect filesystem permissions.",
            retryable: true,
            providerId: "filesystem"
          }
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(2);
    expect(state.orchestratorRuns[0]?.contextRetrievalError?.code).toBe("io_failure");
    expect(state.orchestratorRuns[1]?.contextRetrievalError).toBeUndefined();
  });

  it("normalizes persisted interrupted run records through round-trip", () => {
    const state = normalizeAppState({
      activeView: "orchestrator",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-19T00:00:00.000Z",
      spaces: [
        {
          id: "space-1",
          name: "Space 1",
          rootPath: "/tmp/space-1",
          description: "",
          tags: [],
          createdAt: "2026-02-19T00:00:00.000Z",
          updatedAt: "2026-02-19T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "Session 1",
          createdAt: "2026-02-19T00:00:00.000Z",
          updatedAt: "2026-02-19T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-interrupted",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "resume pending work",
          status: "interrupted",
          statusTimeline: ["queued", "running", "interrupted"],
          createdAt: "2026-02-19T00:00:00.000Z",
          updatedAt: "2026-02-19T00:01:00.000Z",
          interruptedAt: "2026-02-19T00:01:00.000Z",
          resolvedProviderId: "filesystem",
          fallbackFromProviderId: "mcp"
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(1);
    expect(state.orchestratorRuns[0]?.status).toBe("interrupted");
    expect(state.orchestratorRuns[0]?.interruptedAt).toBe("2026-02-19T00:01:00.000Z");
    expect(state.orchestratorRuns[0]?.resolvedProviderId).toBe("filesystem");
    expect(state.orchestratorRuns[0]?.fallbackFromProviderId).toBe("mcp");
  });

  it("drops interrupted runs missing interruptedAt", () => {
    const state = normalizeAppState({
      activeView: "orchestrator",
      activeSpaceId: "space-1",
      activeSessionId: "session-1",
      lastOpenedAt: "2026-02-19T00:00:00.000Z",
      spaces: [
        {
          id: "space-1",
          name: "Space 1",
          rootPath: "/tmp/space-1",
          description: "",
          tags: [],
          createdAt: "2026-02-19T00:00:00.000Z",
          updatedAt: "2026-02-19T00:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          spaceId: "space-1",
          label: "Session 1",
          createdAt: "2026-02-19T00:00:00.000Z",
          updatedAt: "2026-02-19T00:00:00.000Z"
        }
      ],
      orchestratorRuns: [
        {
          id: "run-interrupted-missing-timestamp",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "resume pending work",
          status: "interrupted",
          statusTimeline: ["queued", "running", "interrupted"],
          createdAt: "2026-02-19T00:00:00.000Z",
          updatedAt: "2026-02-19T00:01:00.000Z"
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(0);
  });

  it("drops persisted runs with inconsistent lifecycle timeline metadata", () => {
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
          id: "run-bad",
          spaceId: "space-1",
          sessionId: "session-1",
          prompt: "invalid lifecycle",
          status: "failed",
          statusTimeline: ["queued", "running", "completed"],
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          completedAt: "2026-02-16T00:00:00.000Z"
        }
      ]
    });

    expect(state.orchestratorRuns).toHaveLength(0);
  });
});
