import { describe, expect, it } from "vitest";
import { ProviderRuntimeService } from "./service";
import { ProviderRuntimeError } from "./errors";
import { createProviderRuntimeRegistry } from "./registry";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderAuthResolution,
  ProviderExecuteRequest,
  ProviderRuntimeAdapter
} from "./types";

const MOCK_API_KEY_AUTH: ProviderAuthInput = { preferredMode: "api_key", apiKey: "test-key" };
const MISSING_AUTH: ProviderAuthInput = { preferredMode: "api_key", apiKey: null };

function createMockAdapter(providerId: ModelProviderId): ProviderRuntimeAdapter {
  return {
    providerId,
    capabilities: { supportsApiKey: true, supportsTokenSession: true, supportsModelListing: true },
    resolveAuth: (auth: ProviderAuthInput): ProviderAuthResolution => ({
      requestedMode: auth.preferredMode ?? "api_key",
      resolvedMode: auth.apiKey ? "api_key" : null,
      status: auth.apiKey ? "authenticated" : "error",
      fallbackApplied: false,
      failureCode: auth.apiKey ? null : "missing_auth",
      reason: auth.apiKey ? null : "anthropic API key is required.",
      apiKey: auth.apiKey ?? null,
      tokenSessionId: null
    }),
    listModels: async () => [{ id: `${providerId}-model`, displayName: `${providerId} model` }],
    execute: async (request) => ({
      providerId,
      model: request.model,
      authMode: "api_key",
      text: "hello"
    })
  };
}

function createMockAdapterWithAuthCheck(providerId: ModelProviderId): ProviderRuntimeAdapter {
  return {
    ...createMockAdapter(providerId),
    listModels: async (request) => {
      if (!request.auth.apiKey) {
        throw new ProviderRuntimeError({ providerId, code: "missing_auth", message: "API key required.", remediation: "Add API key.", retryable: false });
      }
      return [{ id: `${providerId}-model`, displayName: `${providerId} model` }];
    },
    execute: async (request) => {
      if (!request.auth.apiKey) {
        throw new ProviderRuntimeError({ providerId, code: "missing_auth", message: "API key required.", remediation: "Add API key.", retryable: false });
      }
      return { providerId, model: request.model, authMode: "api_key", text: "hello" };
    }
  };
}

describe("ProviderRuntimeService.resolveAuth", () => {
  it("returns authenticated status when adapter is registered and auth is valid", () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("anthropic")]);
    const service = new ProviderRuntimeService(registry);

    const result = service.resolveAuth({ providerId: "anthropic", auth: MOCK_API_KEY_AUTH });

    expect(result.providerId).toBe("anthropic");
    expect(result.status).toBe("authenticated");
    expect(result.resolvedMode).toBe("api_key");
    expect("failureCode" in result).toBe(false);
  });

  it("returns error status when auth is missing", () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("anthropic")]);
    const service = new ProviderRuntimeService(registry);

    const result = service.resolveAuth({ providerId: "anthropic", auth: MISSING_AUTH });

    expect(result.status).toBe("error");
    expect(result.providerId).toBe("anthropic");
    expect(result.requestedMode).toBe("api_key");
    if (result.status === "error") {
      expect(result.failureCode).toBe("missing_auth");
      expect(result.resolvedMode).toBeNull();
    }
  });

  it("throws ProviderRuntimeError with provider_unavailable code when provider is not registered", () => {
    const registry = createProviderRuntimeRegistry();
    const service = new ProviderRuntimeService(registry);

    let thrownError: unknown;
    try {
      service.resolveAuth({ providerId: "anthropic", auth: MOCK_API_KEY_AUTH });
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeInstanceOf(ProviderRuntimeError);
    expect((thrownError as ProviderRuntimeError).code).toBe("provider_unavailable");
  });
});

describe("ProviderRuntimeService.listModels", () => {
  it("returns model descriptors from the registered adapter", async () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("openai")]);
    const service = new ProviderRuntimeService(registry);

    const models = await service.listModels({ providerId: "openai", auth: MOCK_API_KEY_AUTH });

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("openai-model");
    expect(models[0].displayName).toBe("openai model");
  });

  it("throws ProviderRuntimeError when adapter rejects missing auth", async () => {
    const adapter = createMockAdapterWithAuthCheck("openai");
    const registry = createProviderRuntimeRegistry([adapter]);
    const service = new ProviderRuntimeService(registry);

    await expect(service.listModels({ providerId: "openai", auth: MISSING_AUTH }))
      .rejects.toBeInstanceOf(ProviderRuntimeError);
  });

  it("throws ProviderRuntimeError with provider_unavailable code when provider is not registered", async () => {
    const registry = createProviderRuntimeRegistry();
    const service = new ProviderRuntimeService(registry);

    await expect(service.listModels({ providerId: "openai", auth: MOCK_API_KEY_AUTH }))
      .rejects.toMatchObject({ code: "provider_unavailable" });
  });
});

describe("ProviderRuntimeService.execute", () => {
  it("returns execute result from the registered adapter", async () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("anthropic")]);
    const service = new ProviderRuntimeService(registry);

    const result = await service.execute({
      providerId: "anthropic",
      auth: MOCK_API_KEY_AUTH,
      model: "claude-3",
      prompt: "Hello"
    });

    expect(result.providerId).toBe("anthropic");
    expect(result.text).toBe("hello");
    expect(result.authMode).toBe("api_key");
  });

  it("throws ProviderRuntimeError when adapter rejects missing auth", async () => {
    const adapter = createMockAdapterWithAuthCheck("anthropic");
    const registry = createProviderRuntimeRegistry([adapter]);
    const service = new ProviderRuntimeService(registry);

    await expect(service.execute({
      providerId: "anthropic",
      auth: MISSING_AUTH,
      model: "claude-3",
      prompt: "Hello"
    })).rejects.toBeInstanceOf(ProviderRuntimeError);
  });

  it("forwards optional fields to the adapter", async () => {
    let capturedRequest: ProviderExecuteRequest | undefined;
    const adapter: ProviderRuntimeAdapter = {
      ...createMockAdapter("anthropic"),
      execute: async (request) => {
        capturedRequest = request;
        return { providerId: "anthropic", model: request.model, authMode: "api_key", text: "hello" };
      }
    };
    const registry = createProviderRuntimeRegistry([adapter]);
    const service = new ProviderRuntimeService(registry);

    await service.execute({
      providerId: "anthropic",
      auth: MOCK_API_KEY_AUTH,
      model: "claude-3",
      prompt: "Hello",
      systemPrompt: "Be helpful",
      maxTokens: 100,
      temperature: 0.5
    });

    expect(capturedRequest?.systemPrompt).toBe("Be helpful");
    expect(capturedRequest?.maxTokens).toBe(100);
    expect(capturedRequest?.temperature).toBe(0.5);
  });

  it("throws ProviderRuntimeError with provider_unavailable code when provider is not registered", async () => {
    const registry = createProviderRuntimeRegistry();
    const service = new ProviderRuntimeService(registry);

    await expect(service.execute({
      providerId: "anthropic",
      auth: MOCK_API_KEY_AUTH,
      model: "claude-3",
      prompt: "Hello"
    })).rejects.toMatchObject({ code: "provider_unavailable" });
  });
});
