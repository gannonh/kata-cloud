import { describe, expect, it } from "vitest";
import { mapProviderRuntimeError, serializeProviderRuntimeError, ProviderRuntimeError } from "./errors.js";

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

  it("classifies missing api key responses as missing_auth", () => {
    const error = mapProviderRuntimeError("anthropic", new Error("missing api key"));

    expect(error.code).toBe("missing_auth");
    expect(error.retryable).toBe(false);
  });

  it("classifies rate limit responses as rate_limited", () => {
    const error = mapProviderRuntimeError("openai", new Error("rate limit exceeded"));

    expect(error.code).toBe("rate_limited");
    expect(error.retryable).toBe(true);
  });

  it("classifies unrecognized errors as unexpected_error", () => {
    const error = mapProviderRuntimeError("anthropic", new Error("some random internal error"));

    expect(error.code).toBe("unexpected_error");
    expect(error.retryable).toBe(false);
  });

  it("classifies non-Error string throws as unexpected_error and uses string as message", () => {
    const error = mapProviderRuntimeError("openai", "plain string error");

    expect(error.code).toBe("unexpected_error");
    expect(error.message).toBe("plain string error");
  });

  it("preserves the original error as cause", () => {
    const original = new Error("original");
    const error = mapProviderRuntimeError("anthropic", original);

    expect(error.cause).toBe(original);
  });

  it("returns the error unchanged when it is already a ProviderRuntimeError", () => {
    const original = new ProviderRuntimeError({
      providerId: "anthropic",
      code: "missing_auth",
      message: "API key required.",
      remediation: "Add API key.",
      retryable: false
    });
    const result = mapProviderRuntimeError("anthropic", original);

    expect(result).toBe(original);
  });
});

describe("serializeProviderRuntimeError", () => {
  it("re-throws ProviderRuntimeError as a plain Error with JSON-encoded message", () => {
    const original = new ProviderRuntimeError({
      providerId: "anthropic",
      code: "missing_auth",
      message: "API key required.",
      remediation: "Add API key.",
      retryable: false
    });

    let caught: unknown;
    try {
      serializeProviderRuntimeError(original);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    const payload = JSON.parse((caught as Error).message);
    expect(payload.code).toBe("missing_auth");
    expect(payload.message).toBe("API key required.");
    expect(payload.remediation).toBe("Add API key.");
    expect(payload.retryable).toBe(false);
    expect(payload.providerId).toBe("anthropic");
  });

  it("includes runtime mode in serialized payload when provided", () => {
    const original = new ProviderRuntimeError({
      providerId: "openai",
      code: "provider_unavailable",
      message: "Provider unavailable.",
      remediation: "Retry shortly.",
      retryable: true
    });

    let caught: unknown;
    try {
      serializeProviderRuntimeError(original, { runtimeMode: "pi" });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    const payload = JSON.parse((caught as Error).message);
    expect(payload.runtimeMode).toBe("pi");
  });

  it("re-throws plain Error unchanged", () => {
    const original = new Error("connection failed");

    let caught: unknown;
    try {
      serializeProviderRuntimeError(original);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(original);
  });

  it("wraps non-Error values in a plain Error", () => {
    let caught: unknown;
    try {
      serializeProviderRuntimeError("string error");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("string error");
  });
});
