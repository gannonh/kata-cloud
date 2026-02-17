import { describe, expect, it } from "vitest";
import { mapProviderRuntimeError } from "./errors";

describe("mapProviderRuntimeError", () => {
  it("classifies token-expired 401 responses as session_expired", () => {
    const error = mapProviderRuntimeError("openai", new Error("401 token expired"));

    expect(error.code).toBe("session_expired");
    expect(error.retryable).toBe(true);
  });

  it("still classifies generic unauthorized responses as invalid_auth", () => {
    const error = mapProviderRuntimeError("anthropic", new Error("401 unauthorized"));

    expect(error.code).toBe("invalid_auth");
    expect(error.retryable).toBe(false);
  });
});
