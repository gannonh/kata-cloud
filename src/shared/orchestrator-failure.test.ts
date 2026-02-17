import { describe, expect, it } from "vitest";
import { hasDeterministicFailureTrigger, resolveRunFailure } from "./orchestrator-failure";

describe("orchestrator deterministic failure trigger", () => {
  it("matches fail keyword case-insensitively", () => {
    expect(hasDeterministicFailureTrigger("please FAIL this run")).toBe(true);
  });

  it("matches run-fail prompts for backward compatibility", () => {
    expect(hasDeterministicFailureTrigger("simulate run-fail behavior")).toBe(true);
  });

  it("does not match failure-related substrings that are not the keyword", () => {
    expect(hasDeterministicFailureTrigger("describe failure handling")).toBe(false);
    expect(hasDeterministicFailureTrigger("build failover flow")).toBe(false);
  });

  it("returns actionable error text when trigger keyword is present", () => {
    expect(resolveRunFailure("fail to build a short plan")).toBe(
      'Deterministic failure triggered by keyword "fail". Remove "fail" from the prompt and rerun.'
    );
  });

  it("returns null when trigger keyword is absent", () => {
    expect(resolveRunFailure("build a short implementation plan")).toBeNull();
  });
});
