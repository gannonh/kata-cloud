import { describe, expect, it, vi } from "vitest";
import { ProviderRuntimeError } from "../../provider-runtime/errors.js";
import { OpenAiProviderAdapter, type OpenAiProviderClient } from "./adapter.js";

describe("OpenAiProviderAdapter", () => {
  it("falls back to api_key when token_session is requested and api key is available", async () => {
    const client = createClient();
    client.execute.mockResolvedValue({ text: "openai says hi" });
    const adapter = new OpenAiProviderAdapter(client);

    const result = await adapter.execute({
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "session-openai", status: "active" },
        apiKey: "sk-openai"
      },
      model: "gpt-4.1",
      prompt: "Say hi"
    });

    expect(result.authMode).toBe("api_key");
    expect(adapter.capabilities.supportsTokenSession).toBe(false);
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(client.execute.mock.calls[0]?.[0].auth).toEqual({
      authMode: "api_key",
      apiKey: "sk-openai",
      tokenSessionId: undefined
    });
  });

  it("falls back to api_key when token_session is expired and fallback is allowed", async () => {
    const client = createClient();
    client.execute.mockResolvedValue({ text: "openai fallback says hi" });
    const adapter = new OpenAiProviderAdapter(client);

    const result = await adapter.execute({
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "expired-openai", status: "expired" },
        apiKey: "sk-openai"
      },
      model: "gpt-4.1",
      prompt: "Say hi"
    });

    expect(result.authMode).toBe("api_key");
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(client.execute.mock.calls[0]?.[0].auth).toEqual({
      authMode: "api_key",
      apiKey: "sk-openai",
      tokenSessionId: undefined
    });
  });

  it("maps upstream rate limit failures to rate_limited", async () => {
    const client = createClient();
    client.execute.mockRejectedValue(new Error("429 rate limit exceeded"));
    const adapter = new OpenAiProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: { preferredMode: "api_key", apiKey: "sk-openai" },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "rate_limited",
      providerId: "openai",
      retryable: true
    } satisfies Partial<ProviderRuntimeError>);
  });

  it("returns invalid_auth when token_session is requested but unsupported and fallback is disabled", async () => {
    const client = createClient();
    const adapter = new OpenAiProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: {
          preferredMode: "token_session",
          tokenSession: { id: "expired-openai", status: "expired" },
          apiKey: "sk-openai",
          allowApiKeyFallback: false
        },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "invalid_auth",
      providerId: "openai"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("returns missing_auth when token_session is requested without usable auth", async () => {
    const client = createClient();
    const adapter = new OpenAiProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: {
          preferredMode: "token_session"
        },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "openai"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.execute).not.toHaveBeenCalled();
  });

  it("normalizes model descriptors from provider responses", async () => {
    const client = createClient();
    client.listModels.mockResolvedValue([
      { id: "gpt-4o", displayName: "GPT-4o" },
      { id: "gpt-4-turbo" }
    ]);
    const adapter = new OpenAiProviderAdapter(client);

    const models = await adapter.listModels({
      auth: { preferredMode: "api_key", apiKey: "sk-openai" }
    });

    expect(models).toEqual([
      { id: "gpt-4o", displayName: "GPT-4o" },
      { id: "gpt-4-turbo", displayName: "gpt-4-turbo" }
    ]);
  });

  it("returns missing_auth in listModels when token_session is requested without usable auth", async () => {
    const client = createClient();
    const adapter = new OpenAiProviderAdapter(client);

    await expect(
      adapter.listModels({
        auth: {
          preferredMode: "token_session"
        }
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "openai"
    } satisfies Partial<ProviderRuntimeError>);
    expect(client.listModels).not.toHaveBeenCalled();
  });
});

function createClient(): {
  listModels: ReturnType<typeof vi.fn<OpenAiProviderClient["listModels"]>>;
  execute: ReturnType<typeof vi.fn<OpenAiProviderClient["execute"]>>;
} {
  return {
    listModels: vi.fn<OpenAiProviderClient["listModels"]>(),
    execute: vi.fn<OpenAiProviderClient["execute"]>()
  };
}
