import { describe, expect, it } from "vitest";
import {
  buildDelegatedTaskTimeline,
  ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE
} from "./orchestrator-delegation.js";

describe("orchestrator delegation timeline", () => {
  it("maps implement, verify, and debug to concrete specialists", () => {
    expect(ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE.implement).toBe("implementor");
    expect(ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE.verify).toBe("verifier");
    expect(ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE.debug).toBe("developer");
  });

  it("produces per-task transitions to terminal completed state", () => {
    const outcome = buildDelegatedTaskTimeline(
      "run-1",
      "Build orchestrator delegation timeline",
      "2026-02-16T00:00:00.000Z"
    );

    expect(outcome.failureMessage).toBeUndefined();
    expect(outcome.tasks).toHaveLength(3);
    expect(outcome.tasks.map((task) => task.type)).toEqual(["implement", "verify", "debug"]);
    expect(outcome.tasks[0]?.statusTimeline).toEqual([
      "queued",
      "delegating",
      "delegated",
      "running",
      "completed"
    ]);
    expect(outcome.tasks.every((task) => task.status === "completed")).toBe(true);
  });

  it("returns actionable failure and consistent terminal states when delegation fails", () => {
    const outcome = buildDelegatedTaskTimeline(
      "run-2",
      "delegate-fail verify the state transitions",
      "2026-02-16T00:00:00.000Z"
    );

    expect(outcome.failureMessage).toBe(
      "Delegation failed for verify. Retry with a narrower verify scope and rerun."
    );
    expect(outcome.tasks).toHaveLength(3);
    expect(outcome.tasks[0]?.status).toBe("completed");
    expect(outcome.tasks[1]?.status).toBe("failed");
    expect(outcome.tasks[1]?.errorMessage).toContain("Retry with a narrower verify scope");
    expect(outcome.tasks[2]?.status).toBe("failed");
    expect(outcome.tasks[2]?.errorMessage).toContain("Skipped because an earlier delegation failed");
  });
});
