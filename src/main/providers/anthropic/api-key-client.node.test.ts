import { describe, expect, it, vi } from "vitest";
import { AnthropicApiKeyClient } from "./api-key-client.js";

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

describe("AnthropicApiKeyClient", () => {
  it("lists models with API key auth and normalizes display names", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: {
          data: [
            { id: "claude-3-5-sonnet", display_name: "Claude 3.5 Sonnet" },
            { id: "claude-3-haiku" },
            { display_name: "invalid model" }
          ]
        }
      })
    );
    const client = new AnthropicApiKeyClient({ fetchFn });

    const result = await client.listModels({ authMode: "api_key", apiKey: "sk-ant" });

    expect(result).toEqual([
      { id: "claude-3-5-sonnet", displayName: "Claude 3.5 Sonnet" },
      { id: "claude-3-haiku" }
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/models");
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": "sk-ant",
        "anthropic-version": "2023-06-01"
      }
    });
  });

  it("executes messages request and maps response text blocks", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: {
          model: "claude-3-5-sonnet-20241022",
          content: [
            { type: "text", text: "First line" },
            { type: "tool_use", id: "tool-1" },
            { type: "text", text: "Second line" }
          ]
        }
      })
    );
    const client = new AnthropicApiKeyClient({ fetchFn });

    const result = await client.execute({
      auth: { authMode: "api_key", apiKey: "sk-ant" },
      model: "claude-3-5-sonnet",
      prompt: "Say hello",
      systemPrompt: "Be concise",
      maxTokens: 256,
      temperature: 0.3
    });

    expect(result).toEqual({
      model: "claude-3-5-sonnet-20241022",
      text: "First line\nSecond line"
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.anthropic.com/v1/messages");

    const request = fetchFn.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": "sk-ant",
        "anthropic-version": "2023-06-01"
      }
    });
    expect(JSON.parse((request?.body as string) ?? "{}")).toEqual({
      model: "claude-3-5-sonnet",
      max_tokens: 256,
      messages: [{ role: "user", content: "Say hello" }],
      system: "Be concise",
      temperature: 0.3
    });
  });

  it("requires API key auth mode before calling Anthropic APIs", async () => {
    const fetchFn = vi.fn<MockFetch>();
    const client = new AnthropicApiKeyClient({ fetchFn });

    await expect(
      client.listModels({ authMode: "token_session", tokenSessionId: "session-1" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "missing_auth",
      providerId: "anthropic"
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps 401 responses to invalid_auth", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: false,
        status: 401,
        jsonBody: { error: { message: "invalid api key" } }
      })
    );
    const client = new AnthropicApiKeyClient({ fetchFn });

    await expect(
      client.listModels({ authMode: "api_key", apiKey: "sk-ant" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "invalid_auth",
      retryable: false,
      providerId: "anthropic"
    });
  });

  it("maps 429 responses to rate_limited", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: false,
        status: 429,
        jsonBody: { error: { message: "rate limit exceeded" } }
      })
    );
    const client = new AnthropicApiKeyClient({ fetchFn });

    await expect(
      client.execute({
        auth: { authMode: "api_key", apiKey: "sk-ant" },
        model: "claude-3-5-sonnet",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "rate_limited",
      retryable: true,
      providerId: "anthropic"
    });
  });

  it("maps 5xx and malformed payload responses to provider_unavailable/unexpected_error", async () => {
    const unavailableFetch = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: false,
        status: 529,
        jsonBody: { error: { message: "overloaded" } }
      })
    );
    const unavailableClient = new AnthropicApiKeyClient({ fetchFn: unavailableFetch });

    await expect(
      unavailableClient.listModels({ authMode: "api_key", apiKey: "sk-ant" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "provider_unavailable",
      retryable: true,
      providerId: "anthropic"
    });

    const malformedFetch = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: { content: [{ type: "tool_use", id: "tool-1" }] }
      })
    );
    const malformedClient = new AnthropicApiKeyClient({ fetchFn: malformedFetch });

    await expect(
      malformedClient.execute({
        auth: { authMode: "api_key", apiKey: "sk-ant" },
        model: "claude-3-5-sonnet",
        prompt: "Hello"
      })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "unexpected_error",
      retryable: false,
      providerId: "anthropic"
    });
  });

  it("enforces a minimum max_tokens of 1 for positive fractional values", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: {
          model: "claude-3-5-sonnet-20241022",
          content: [{ type: "text", text: "ok" }]
        }
      })
    );
    const client = new AnthropicApiKeyClient({ fetchFn });

    await client.execute({
      auth: { authMode: "api_key", apiKey: "sk-ant" },
      model: "claude-3-5-sonnet",
      prompt: "Hi",
      maxTokens: 0.5
    });

    const request = fetchFn.mock.calls[0]?.[1];
    expect(JSON.parse((request?.body as string) ?? "{}")).toMatchObject({ max_tokens: 1 });
  });

  it("maps transport failures to provider_unavailable", async () => {
    const transportError = new Error("connect ECONNRESET");
    const fetchFn = vi.fn<MockFetch>().mockRejectedValue(transportError);
    const client = new AnthropicApiKeyClient({ fetchFn });

    await expect(
      client.listModels({ authMode: "api_key", apiKey: "sk-ant" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "provider_unavailable",
      retryable: true,
      providerId: "anthropic",
      cause: transportError
    });
  });

  it("returns unexpected_error for malformed model list payloads", async () => {
    const fetchFn = vi.fn<MockFetch>().mockResolvedValue(
      createResponse({
        ok: true,
        status: 200,
        jsonBody: { data: "not-an-array" }
      })
    );
    const client = new AnthropicApiKeyClient({ fetchFn });

    await expect(
      client.listModels({ authMode: "api_key", apiKey: "sk-ant" })
    ).rejects.toMatchObject({
      name: "ProviderRuntimeError",
      code: "unexpected_error",
      providerId: "anthropic"
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
