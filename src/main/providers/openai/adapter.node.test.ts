import { describe, expect, it, vi } from "vitest";
import { ProviderRuntimeError } from "../../provider-runtime/errors";
import { OpenAiProviderAdapter, type OpenAiProviderClient } from "./adapter";

describe("OpenAiProviderAdapter", () => {
  it("uses token_session mode when an active token session is available", async () => {
    const client = createClient();
    client.execute.mockResolvedValue({ text: "openai says hi" });
    const adapter = new OpenAiProviderAdapter(client);

    const result = await adapter.execute({
      auth: {
        preferredMode: "token_session",
        tokenSession: { id: "session-openai", status: "active" }
      },
      model: "gpt-4.1",
      prompt: "Say hi"
    });

    expect(result.authMode).toBe("token_session");
    expect(client.execute).toHaveBeenCalledTimes(1);
    expect(client.execute.mock.calls[0]?.[0].auth).toEqual({
      authMode: "token_session",
      apiKey: undefined,
      tokenSessionId: "session-openai"
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

  it("maps session-expired auth failures when token mode cannot fall back", async () => {
    const client = createClient();
    const adapter = new OpenAiProviderAdapter(client);

    await expect(
      adapter.execute({
        auth: {
          preferredMode: "token_session",
          tokenSession: { id: "expired-openai", status: "expired" }
        },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "session_expired",
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

  it("enforces session_expired in listModels when token session has expired", async () => {
    const client = createClient();
    const adapter = new OpenAiProviderAdapter(client);

    await expect(
      adapter.listModels({
        auth: {
          preferredMode: "token_session",
          tokenSession: { id: "expired-openai", status: "expired" }
        }
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "session_expired",
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
