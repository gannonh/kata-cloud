import { describe, expect, it, vi } from "vitest";
import { ProviderRuntimeError } from "../../provider-runtime/errors";
import { AnthropicProviderAdapter, type AnthropicProviderClient } from "./adapter";

describe("AnthropicProviderAdapter", () => {
  it("falls back to api_key when token session is requested and provider does not support token sessions", async () => {
    const client = createClient();
    client.execute.mockResolvedValue({ text: "hello from anthropic" });
    const adapter = new AnthropicProviderAdapter(client);

    const result = await adapter.execute({
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "session-1", status: "active" },
        apiKey: "sk-ant"
      },
      model: "claude-3-5-sonnet",
      prompt: "Say hello"
    });

    expect(result.authMode).toBe("api_key");
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(client.execute.mock.calls[0]?.[0].auth).toEqual({
      authMode: "api_key",
      apiKey: "sk-ant",
      tokenSessionId: undefined
    });
  });

  it("returns missing_auth when token session mode is requested without API key fallback", async () => {
    const client = createClient();
    const adapter = new AnthropicProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: {
          preferredMode: "token_session",
          tokenSession: { id: "session-1", status: "active" }
        },
        model: "claude-3-5-sonnet",
        prompt: "Say hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "anthropic"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("enforces missing_auth in explicit api_key mode without a key", async () => {
    const client = createClient();
    const adapter = new AnthropicProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: {
          preferredMode: "api_key",
          tokenSession: { id: "session-1", status: "active" }
        },
        model: "claude-3-5-sonnet",
        prompt: "Say hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "anthropic"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("throws unexpected_error when auth resolution is inconsistent", async () => {
    const client = createClient();
    const adapter = new AnthropicProviderAdapter(client);
    vi.spyOn(adapter, "resolveAuth").mockReturnValue({
      requestedMode: "api_key",
      resolvedMode: null,
      status: "authenticated",
      fallbackApplied: false,
      failureCode: null,
      reason: null,
      apiKey: "sk-ant",
      tokenSessionId: null
    });

    await expect(
      adapter.execute({
        auth: { preferredMode: "api_key", apiKey: "sk-ant" },
        model: "claude-3-5-sonnet",
        prompt: "Say hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "unexpected_error",
      providerId: "anthropic"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("maps upstream unauthorized failures to invalid_auth", async () => {
    const client = createClient();
    client.execute.mockRejectedValue(new Error("401 unauthorized"));
    const adapter = new AnthropicProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: { preferredMode: "api_key", apiKey: "sk-ant" },
        model: "claude-3-5-sonnet",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "invalid_auth",
      providerId: "anthropic"
    } satisfies Partial<ProviderRuntimeError>);
  });

  it("normalizes model descriptors from provider responses", async () => {
    const client = createClient();
    client.listModels.mockResolvedValue([
      { id: "claude-3-5-sonnet", displayName: "Claude 3.5 Sonnet" },
      { id: "claude-3-haiku" }
    ]);
    const adapter = new AnthropicProviderAdapter(client);

    const models = await adapter.listModels({
      auth: { preferredMode: "api_key", apiKey: "sk-ant" }
    });

    expect(models).toEqual([
      { id: "claude-3-5-sonnet", displayName: "Claude 3.5 Sonnet" },
      { id: "claude-3-haiku", displayName: "claude-3-haiku" }
    ]);
  });

  it("falls back to api_key when token session is expired and api key is available", async () => {
    const client = createClient();
    client.execute.mockResolvedValue({ text: "hello from anthropic" });
    const adapter = new AnthropicProviderAdapter(client);

    const result = await adapter.execute({
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "expired-session", status: "expired" },
        apiKey: "sk-ant"
      },
      model: "claude-3-5-sonnet",
      prompt: "Say hello"
    });

    expect(result.authMode).toBe("api_key");
    expect(client.execute.mock.calls[0]?.[0].auth).toEqual({
      authMode: "api_key",
      apiKey: "sk-ant",
      tokenSessionId: undefined
    });
  });

  it("returns missing_auth when token session is expired and no api key is available", async () => {
    const client = createClient();
    const adapter = new AnthropicProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: {
          preferredMode: "token_session",
          tokenSession: { id: "expired-session", status: "expired" }
        },
        model: "claude-3-5-sonnet",
        prompt: "Say hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "anthropic"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("enforces missing_auth in listModels when API key mode is requested without a key", async () => {
    const client = createClient();
    const adapter = new AnthropicProviderAdapter(client);

    await expect(
      adapter.listModels({
        auth: { preferredMode: "api_key" }
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "anthropic"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.listModels).not.toHaveBeenCalled();
  });
});

function createClient(): {
  listModels: ReturnType<typeof vi.fn<AnthropicProviderClient["listModels"]>>;
  execute: ReturnType<typeof vi.fn<AnthropicProviderClient["execute"]>>;
} {
  return {
    listModels: vi.fn<AnthropicProviderClient["listModels"]>(),
    execute: vi.fn<AnthropicProviderClient["execute"]>()
  };
}
