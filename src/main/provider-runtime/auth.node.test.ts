import { describe, expect, it } from "vitest";
import { resolveProviderAuth } from "./auth";

describe("resolveProviderAuth", () => {
  it("uses token session mode when a valid token session is active", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "session-1", status: "active" },
        apiKey: "sk-ant"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("token_session");
    expect(resolution.fallbackApplied).toBe(false);
    expect(resolution.tokenSessionId).toBe("session-1");
  });

  it("falls back to API key when token session is expired and fallback is allowed", () => {
    const resolution = resolveProviderAuth({
      providerId: "openai",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "expired-openai", status: "expired" },
        apiKey: "sk-openai"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("api_key");
    expect(resolution.fallbackApplied).toBe(true);
    expect(resolution.apiKey).toBe("sk-openai");
  });

  it("returns session_expired when token session has expired and fallback is disabled", () => {
    const resolution = resolveProviderAuth({
      providerId: "openai",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "expired-openai", status: "expired" },
        apiKey: "sk-openai",
        allowApiKeyFallback: false
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("session_expired");
    expect(resolution.resolvedMode).toBeNull();
  });

  it("falls back to API key when provider does not support token sessions and fallback is allowed", () => {
    const resolution = resolveProviderAuth({
      providerId: "openai",
      supportsTokenSession: false,
      auth: {
        preferredMode: "token_session",
        apiKey: "sk-openai"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("api_key");
    expect(resolution.fallbackApplied).toBe(true);
  });

  it("returns invalid_auth when token session mode is unsupported and fallback is disabled", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: false,
      auth: {
        preferredMode: "token_session",
        apiKey: "sk-ant",
        allowApiKeyFallback: false
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("invalid_auth");
    expect(resolution.resolvedMode).toBeNull();
  });

  it("returns invalid_auth when active token session is missing a session id and fallback is disabled", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: " ", status: "active" },
        apiKey: "sk-ant",
        allowApiKeyFallback: false
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("invalid_auth");
    expect(resolution.resolvedMode).toBeNull();
  });

  it("requires API key when api_key mode is explicitly requested", () => {
    const resolution = resolveProviderAuth({
      providerId: "openai",
      supportsTokenSession: true,
      auth: {
        preferredMode: "api_key",
        tokenSession: { id: "session-2", status: "active" }
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("missing_auth");
    expect(resolution.fallbackApplied).toBe(false);
  });
});
