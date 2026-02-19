import { describe, expect, it } from "vitest";
import {
  transitionOrchestratorRunStatus
} from "./orchestrator-run-lifecycle";
import type { OrchestratorRunRecord } from "./state";

function createQueuedRun(): OrchestratorRunRecord {
  return {
    id: "run-1",
    spaceId: "space-1",
    sessionId: "session-1",
    prompt: "Build lifecycle primitives",
    status: "queued",
    statusTimeline: ["queued"],
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  };
}

describe("orchestrator run lifecycle transitions", () => {
  it("applies deterministic queued -> running -> completed progression", () => {
    const queuedRun = createQueuedRun();
    const running = transitionOrchestratorRunStatus(
      queuedRun,
      "running",
      "2026-02-18T00:00:01.000Z"
    );
    expect(running.ok).toBe(true);
    if (!running.ok) {
      return;
    }

    const completed = transitionOrchestratorRunStatus(
      running.run,
      "completed",
      "2026-02-18T00:00:02.000Z"
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }

    expect(completed.run.status).toBe("completed");
    expect(completed.run.statusTimeline).toEqual(["queued", "running", "completed"]);
    expect(completed.run.completedAt).toBe("2026-02-18T00:00:02.000Z");
    expect(completed.run.errorMessage).toBeUndefined();
  });

  it("applies queued -> interrupted transition", () => {
    const queuedRun = createQueuedRun();
    const interrupted = transitionOrchestratorRunStatus(
      queuedRun,
      "interrupted",
      "2026-02-19T00:00:01.000Z"
    );
    expect(interrupted.ok).toBe(true);
    if (!interrupted.ok) {
      return;
    }

    expect(interrupted.run.status).toBe("interrupted");
    expect(interrupted.run.statusTimeline).toEqual(["queued", "interrupted"]);
    expect(interrupted.run.interruptedAt).toBe("2026-02-19T00:00:01.000Z");
    expect(interrupted.run.completedAt).toBeUndefined();
  });

  it("applies running -> interrupted transition", () => {
    const queuedRun = createQueuedRun();
    const running = transitionOrchestratorRunStatus(
      queuedRun,
      "running",
      "2026-02-19T00:00:01.000Z"
    );
    expect(running.ok).toBe(true);
    if (!running.ok) {
      return;
    }

    const interrupted = transitionOrchestratorRunStatus(
      running.run,
      "interrupted",
      "2026-02-19T00:00:02.000Z"
    );
    expect(interrupted.ok).toBe(true);
    if (!interrupted.ok) {
      return;
    }

    expect(interrupted.run.status).toBe("interrupted");
    expect(interrupted.run.statusTimeline).toEqual(["queued", "running", "interrupted"]);
    expect(interrupted.run.interruptedAt).toBe("2026-02-19T00:00:02.000Z");
    expect(interrupted.run.completedAt).toBeUndefined();
  });

  it("is idempotent for duplicate statuses", () => {
    const queuedRun = createQueuedRun();
    const first = transitionOrchestratorRunStatus(
      queuedRun,
      "running",
      "2026-02-18T00:00:01.000Z"
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const duplicate = transitionOrchestratorRunStatus(
      first.run,
      "running",
      "2026-02-18T00:00:02.000Z"
    );
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok) {
      return;
    }

    expect(duplicate.run.status).toBe("running");
    expect(duplicate.run.statusTimeline).toEqual(["queued", "running"]);
    expect(duplicate.run.updatedAt).toBe("2026-02-18T00:00:02.000Z");
  });

  it("clears stale errorMessage when idempotent non-failed transition occurs", () => {
    const runWithStaleError: OrchestratorRunRecord = {
      id: "run-1",
      spaceId: "space-1",
      sessionId: "session-1",
      prompt: "Build lifecycle primitives",
      status: "running",
      statusTimeline: ["queued", "running"],
      createdAt: "2026-02-18T00:00:00.000Z",
      updatedAt: "2026-02-18T00:00:01.000Z",
      errorMessage: "Stale error from previous attempt."
    };

    const result = transitionOrchestratorRunStatus(
      runWithStaleError,
      "running",
      "2026-02-18T00:00:02.000Z"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.run.errorMessage).toBeUndefined();
    expect(result.run.updatedAt).toBe("2026-02-18T00:00:02.000Z");
  });

  it("rejects invalid lifecycle jumps", () => {
    const queuedRun = createQueuedRun();
    const invalid = transitionOrchestratorRunStatus(
      queuedRun,
      "completed",
      "2026-02-18T00:00:01.000Z"
    );

    expect(invalid.ok).toBe(false);
    if (invalid.ok) {
      return;
    }

    expect(invalid.reason).toContain("queued -> completed");
    expect(invalid.run.status).toBe("queued");
    expect(invalid.run.statusTimeline).toEqual(["queued"]);
  });

  it("rejects queued -> failed (skips running)", () => {
    const queuedRun = createQueuedRun();
    const result = transitionOrchestratorRunStatus(queuedRun, "failed", "2026-02-18T00:00:01.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.reason).toContain("queued -> failed");
    expect(result.run.status).toBe("queued");
  });

  it("rejects completed -> running (re-queue attempt)", () => {
    const queuedRun = createQueuedRun();
    const running = transitionOrchestratorRunStatus(queuedRun, "running", "2026-02-18T00:00:01.000Z");
    if (!running.ok) return;
    const completed = transitionOrchestratorRunStatus(running.run, "completed", "2026-02-18T00:00:02.000Z");
    if (!completed.ok) return;

    const result = transitionOrchestratorRunStatus(completed.run, "running", "2026-02-18T00:00:03.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.reason).toContain("completed -> running");
    expect(result.run.status).toBe("completed");
  });

  it("rejects failed -> running (retry attempt)", () => {
    const queuedRun = createQueuedRun();
    const running = transitionOrchestratorRunStatus(queuedRun, "running", "2026-02-18T00:00:01.000Z");
    if (!running.ok) return;
    const failed = transitionOrchestratorRunStatus(running.run, "failed", "2026-02-18T00:00:02.000Z", "err");
    if (!failed.ok) return;

    const result = transitionOrchestratorRunStatus(failed.run, "running", "2026-02-18T00:00:03.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.reason).toContain("failed -> running");
    expect(result.run.status).toBe("failed");
  });

  it("rejects interrupted -> running transition", () => {
    const queuedRun = createQueuedRun();
    const interrupted = transitionOrchestratorRunStatus(
      queuedRun,
      "interrupted",
      "2026-02-19T00:00:01.000Z"
    );
    expect(interrupted.ok).toBe(true);
    if (!interrupted.ok) {
      return;
    }

    const result = transitionOrchestratorRunStatus(
      interrupted.run,
      "running",
      "2026-02-19T00:00:02.000Z"
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.reason).toContain("interrupted -> running");
  });

  it("preserves failure context in failed terminal state", () => {
    const queuedRun = createQueuedRun();
    const running = transitionOrchestratorRunStatus(
      queuedRun,
      "running",
      "2026-02-18T00:00:01.000Z"
    );
    expect(running.ok).toBe(true);
    if (!running.ok) {
      return;
    }

    const failed = transitionOrchestratorRunStatus(
      running.run,
      "failed",
      "2026-02-18T00:00:02.000Z",
      "Delegation failed for verify."
    );
    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      return;
    }

    expect(failed.run.status).toBe("failed");
    expect(failed.run.statusTimeline).toEqual(["queued", "running", "failed"]);
    expect(failed.run.errorMessage).toBe("Delegation failed for verify.");
    expect(failed.run.completedAt).toBe("2026-02-18T00:00:02.000Z");
  });
});
