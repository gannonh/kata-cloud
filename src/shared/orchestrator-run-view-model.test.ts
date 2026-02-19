import { describe, expect, it } from "vitest";
import {
  projectOrchestratorRunHistory,
  projectOrchestratorRunViewModel
} from "./orchestrator-run-view-model.js";
import type { OrchestratorRunRecord } from "./state.js";

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
    expect(projection.delegatedTasks[1]?.lifecycleText).toBe("Queued -> Delegating -> Failed");
    expect(projection.errorMessage).toBe("Delegation failed for verify.");
  });

  it("labels interrupted runs as Interrupted", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        status: "interrupted",
        statusTimeline: ["queued", "running", "interrupted"],
        completedAt: undefined,
        interruptedAt: "2026-02-19T00:00:00.000Z"
      })
    );

    expect(projection.statusLabel).toBe("Interrupted");
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

  it("projects actionable context retrieval diagnostics", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        contextRetrievalError: {
          code: "provider_unavailable",
          message: "MCP runtime is unavailable.",
          remediation: "Retry with filesystem provider or configure MCP runtime.",
          retryable: true,
          providerId: "mcp"
        }
      })
    );

    expect(projection.contextDiagnostics?.code).toBe("provider_unavailable");
    expect(projection.contextDiagnostics?.providerId).toBe("mcp");
    expect(projection.contextDiagnostics?.retryable).toBe(true);
    expect(projection.contextDiagnostics?.remediation).toContain("filesystem");
  });

  it("projects provider execution telemetry for successful runs", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        providerExecution: {
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet-latest",
          runtimeMode: "native",
          status: "succeeded"
        }
      })
    );

    expect(projection.providerExecution?.providerId).toBe("anthropic");
    expect(projection.providerExecution?.modelId).toBe("claude-3-5-sonnet-latest");
    expect(projection.providerExecution?.runtimeMode).toBe("native");
    expect(projection.providerExecution?.status).toBe("succeeded");
    expect(projection.providerExecution?.errorCode).toBeUndefined();
  });

  it("projects provider execution diagnostics for failures", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        status: "failed",
        statusTimeline: ["queued", "running", "failed"],
        errorMessage: "Provider runtime failed.",
        providerExecution: {
          providerId: "openai",
          modelId: "gpt-4o-mini",
          runtimeMode: "pi",
          status: "failed",
          errorCode: "missing_auth",
          remediation: "Configure provider credentials and retry.",
          retryable: false
        }
      })
    );

    expect(projection.providerExecution?.providerId).toBe("openai");
    expect(projection.providerExecution?.runtimeMode).toBe("pi");
    expect(projection.providerExecution?.status).toBe("failed");
    expect(projection.providerExecution?.errorCode).toBe("missing_auth");
    expect(projection.providerExecution?.retryable).toBe(false);
  });

  it("projects context provenance when resolvedProviderId is present", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        resolvedProviderId: "filesystem",
        contextSnippets: [
          {
            id: "snippet-1",
            provider: "filesystem",
            source: "filesystem",
            path: "/tmp/project/src/main.tsx",
            content: "snippet one",
            score: 0.8
          },
          {
            id: "snippet-2",
            provider: "filesystem",
            source: "filesystem",
            path: "/tmp/project/src/state.ts",
            content: "snippet two",
            score: 0.7
          }
        ]
      })
    );

    expect(projection.contextProvenance?.resolvedProviderId).toBe("filesystem");
    expect(projection.contextProvenance?.snippetCount).toBe(2);
    expect(projection.contextProvenance?.fallbackFromProviderId).toBeUndefined();
  });

  it("projects fallback provenance from explicit run metadata", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        resolvedProviderId: "filesystem",
        fallbackFromProviderId: "mcp",
        contextSnippets: []
      })
    );

    expect(projection.contextProvenance?.resolvedProviderId).toBe("filesystem");
    expect(projection.contextProvenance?.snippetCount).toBe(0);
    expect(projection.contextProvenance?.fallbackFromProviderId).toBe("mcp");
  });

  it("prefers explicit fallbackFromProviderId over legacy snippet inference", () => {
    // resolvedProviderId = "mcp", explicit fallback = "filesystem", snippet provider = "mcp"
    // Legacy inference: snippets[0].provider === resolvedProviderId => returns undefined
    // Result: explicit "filesystem" wins over legacy undefined
    const projection = projectOrchestratorRunViewModel(
      createRun({
        resolvedProviderId: "mcp",
        fallbackFromProviderId: "filesystem",
        contextSnippets: [
          {
            id: "snippet-1",
            provider: "mcp",
            source: "mcp",
            path: "/tmp/project/src/main.tsx",
            content: "snippet one",
            score: 0.8
          }
        ]
      })
    );

    expect(projection.contextProvenance?.resolvedProviderId).toBe("mcp");
    expect(projection.contextProvenance?.fallbackFromProviderId).toBe("filesystem");
  });

  it("infers fallback provenance from snippets for legacy runs", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        resolvedProviderId: "mcp",
        contextSnippets: [
          {
            id: "snippet-1",
            provider: "filesystem",
            source: "filesystem",
            path: "/tmp/project/src/main.tsx",
            content: "snippet one",
            score: 0.8
          }
        ]
      })
    );

    expect(projection.contextProvenance?.resolvedProviderId).toBe("mcp");
    expect(projection.contextProvenance?.fallbackFromProviderId).toBe("filesystem");
  });

  it("omits contextProvenance when resolvedProviderId is absent", () => {
    const projection = projectOrchestratorRunViewModel(
      createRun({
        resolvedProviderId: undefined,
        contextSnippets: [
          {
            id: "snippet-1",
            provider: "filesystem",
            source: "filesystem",
            path: "/tmp/project/src/main.tsx",
            content: "snippet one",
            score: 0.8
          }
        ]
      })
    );

    expect(projection.contextProvenance).toBeUndefined();
  });

  it("projects run history arrays without reordering", () => {
    const runHistory = projectOrchestratorRunHistory([
      createRun({ id: "run-a", prompt: "First" }),
      createRun({ id: "run-b", prompt: "Second" })
    ]);

    expect(runHistory.map((run) => run.id)).toEqual(["run-a", "run-b"]);
  });
});
