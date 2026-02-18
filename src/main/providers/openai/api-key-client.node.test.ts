import { describe, expect, it, vi } from "vitest";
import { OpenAiApiKeyClient } from "./api-key-client";

type MockFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type MockFetch = (
  input: string,
  init?: RequestInit
) => Promise<MockFetchResponse>;

describe("OpenAiApiKeyClient", () => {
  it("lists models with API key auth and normalizes display names", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: {
          data: [
            { id: "gpt-4.1", name: "GPT-4.1" },
            { id: "gpt-4o-mini" },
            { name: "invalid model" }
          ]
        }
      })
    );
    const client = new OpenAiApiKeyClient({ fetchFn });

    const result = await client.listModels({ authMode: "api_key", apiKey: "sk-openai" });

    expect(result).toEqual([
      { id: "gpt-4.1", displayName: "GPT-4.1" },
      { id: "gpt-4o-mini" }
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/models");
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer sk-openai"
      }
    });
  });

  it("executes chat completions and maps text output", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: {
          model: "gpt-4.1-2026-01-15",
          choices: [
            {
              message: {
                content: "First line\nSecond line"
              }
            }
          ]
        }
      })
    );
    const client = new OpenAiApiKeyClient({ fetchFn });

    const result = await client.execute({
      auth: { authMode: "api_key", apiKey: "sk-openai" },
      model: "gpt-4.1",
      prompt: "Say hello",
      systemPrompt: "Be concise",
      maxTokens: 256,
      temperature: 0.2
    });

    expect(result).toEqual({
      model: "gpt-4.1-2026-01-15",
      text: "First line\nSecond line"
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer sk-openai"
      }
    });
    expect(JSON.parse((fetchFn.mock.calls[0]?.[1]?.body as string) ?? "{}")).toEqual({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "Be concise" },
        { role: "user", content: "Say hello" }
      ],
      max_tokens: 256,
      temperature: 0.2
    });
  });

  it("returns unexpected_error for malformed payloads", async () => {
    const malformedModelsFetch = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: { data: "not-an-array" }
      })
    );
    const clientWithMalformedModels = new OpenAiApiKeyClient({ fetchFn: malformedModelsFetch });

    await expect(
      clientWithMalformedModels.listModels({ authMode: "api_key", apiKey: "sk-openai" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "unexpected_error",
      providerId: "openai"
    });

    const malformedExecuteFetch = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: { choices: [{ message: { content: [{ type: "image" }] } }] }
      })
    );
    const clientWithMalformedExecute = new OpenAiApiKeyClient({ fetchFn: malformedExecuteFetch });

    await expect(
      clientWithMalformedExecute.execute({
        auth: { authMode: "api_key", apiKey: "sk-openai" },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "unexpected_error",
      providerId: "openai"
    });
  });

  it("maps auth and HTTP failures to provider-runtime taxonomy", async () => {
    const unauthorizedFetch = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: false,
        status: 401,
        jsonBody: { error: { message: "invalid api key" } }
      })
    );
    const unauthorizedClient = new OpenAiApiKeyClient({ fetchFn: unauthorizedFetch });
    await expect(
      unauthorizedClient.listModels({ authMode: "api_key", apiKey: "sk-openai" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "invalid_auth",
      retryable: false,
      providerId: "openai"
    });

    const rateLimitedFetch = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: false,
        status: 429,
        jsonBody: { error: { message: "rate limit exceeded" } }
      })
    );
    const rateLimitedClient = new OpenAiApiKeyClient({ fetchFn: rateLimitedFetch });
    await expect(
      rateLimitedClient.execute({
        auth: { authMode: "api_key", apiKey: "sk-openai" },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "rate_limited",
      retryable: true,
      providerId: "openai"
    });
  });

  it("maps transport failures to provider_unavailable", async () => {
    const transportError = new Error("connect ECONNRESET");
    const fetchFn = vi.fn<MockFetch>().mockRejectedValue(transportError);
    const client = new OpenAiApiKeyClient({ fetchFn });

    await expect(
      client.execute({
        auth: { authMode: "api_key", apiKey: "sk-openai" },
        model: "gpt-4.1",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "provider_unavailable",
      retryable: true,
      providerId: "openai",
      cause: transportError
    });
  });
});

function createResponse(input: {
  ok: boolean;
  status: number;
  jsonBody: unknown;
  textBody?: string;
}): MockFetchResponse {
  return {
    ok: input.ok,
    status: input.status,
    json: async () => input.jsonBody,
    text: async () => input.textBody ?? JSON.stringify(input.jsonBody)
  };
}
