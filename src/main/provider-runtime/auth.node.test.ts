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

  it("falls back to API key when no active token session exists", () => {
    const resolution = resolveProviderAuth({
      providerId: "openai",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: null,
        apiKey: "sk-openai"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("api_key");
    expect(resolution.fallbackApplied).toBe(true);
    expect(resolution.apiKey).toBe("sk-openai");
  });

  it("falls back to API key when provider does not support token sessions", () => {
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

  it("returns session_expired when token session has expired and no API key fallback is available", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "expired-session", status: "expired" }
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("session_expired");
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

  it("resolves to api_key when api_key mode is requested and key is present", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: false,
      auth: {
        preferredMode: "api_key",
        apiKey: "sk-ant"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("api_key");
    expect(resolution.fallbackApplied).toBe(false);
    expect(resolution.apiKey).toBe("sk-ant");
  });

  it("returns missing_auth when api_key mode is requested and key is absent", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: false,
      auth: {
        preferredMode: "api_key"
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("missing_auth");
    expect(resolution.resolvedMode).toBeNull();
  });

  it("falls back to api_key when token session is active but has no valid session id", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "", status: "active" },
        apiKey: "sk-ant"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("api_key");
    expect(resolution.fallbackApplied).toBe(true);
    expect(resolution.apiKey).toBe("sk-ant");
  });

  it("returns invalid_auth when token session is active, session id is empty, and no api key", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "", status: "active" }
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("invalid_auth");
    expect(resolution.resolvedMode).toBeNull();
  });

  it("falls back to api_key when token session is expired and api key is available (supportsTokenSession: true)", () => {
    const resolution = resolveProviderAuth({
      providerId: "anthropic",
      supportsTokenSession: true,
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "expired-session", status: "expired" },
        apiKey: "sk-ant"
      }
    });

    expect(resolution.status).toBe("authenticated");
    expect(resolution.resolvedMode).toBe("api_key");
    expect(resolution.fallbackApplied).toBe(true);
    expect(resolution.apiKey).toBe("sk-ant");
  });

  it("returns missing_auth when no token session and no api key (supportsTokenSession: false)", () => {
    const resolution = resolveProviderAuth({
      providerId: "openai",
      supportsTokenSession: false,
      auth: {
        preferredMode: "token_session"
      }
    });

    expect(resolution.status).toBe("error");
    expect(resolution.failureCode).toBe("missing_auth");
    expect(resolution.resolvedMode).toBeNull();
  });
});
