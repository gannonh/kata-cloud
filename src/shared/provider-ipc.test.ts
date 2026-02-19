import { describe, expect, it } from "vitest";
import { parseProviderIpcError } from "./provider-ipc.js";

describe("parseProviderIpcError", () => {
  it("parses payloads with runtimeMode metadata", () => {
    const parsed = parseProviderIpcError(
      new Error(
        JSON.stringify({
          code: "missing_auth",
          message: "API key required.",
          remediation: "Add API key.",
          retryable: false,
          providerId: "anthropic",
          runtimeMode: "pi"
        })
      )
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.runtimeMode).toBe("pi");
  });

  it("rejects payloads with invalid runtimeMode values", () => {
    const parsed = parseProviderIpcError(
      new Error(
        JSON.stringify({
          code: "missing_auth",
          message: "API key required.",
          remediation: "Add API key.",
          retryable: false,
          providerId: "anthropic",
          runtimeMode: "unsupported"
        })
      )
    );

    expect(parsed).toBeNull();
  });
});
