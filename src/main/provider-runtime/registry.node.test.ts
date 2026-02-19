import { describe, expect, it } from "vitest";
import { ProviderRuntimeError } from "./errors.js";
import { createProviderRuntimeRegistry, resolveModelProviderId } from "./registry.js";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderAuthResolution,
  ProviderRuntimeAdapter
} from "./types.js";

describe("createProviderRuntimeRegistry", () => {
  it("registers and resolves provider adapters", () => {
    const anthropic = createMockAdapter("anthropic");
    const openai = createMockAdapter("openai");

    const registry = createProviderRuntimeRegistry([anthropic, openai]);

    expect(registry.get("anthropic")).toBe(anthropic);
    expect(registry.get("openai")).toBe(openai);
    expect(registry.list()).toHaveLength(2);
  });

  it("rejects duplicate provider registration", () => {
    const anthropic = createMockAdapter("anthropic");
    const registry = createProviderRuntimeRegistry([anthropic]);

    expect(() => registry.register(createMockAdapter("anthropic"))).toThrow(
      'Provider "anthropic" is already registered.'
    );
  });

  it("throws provider_unavailable when requiring a provider that is not registered", () => {
    const registry = createProviderRuntimeRegistry();

    expect(() => registry.require("openai")).toThrow(ProviderRuntimeError);
    expect(() => registry.require("openai")).toThrow(
      'Provider "openai" is not registered in this runtime.'
    );
  });
});

describe("resolveModelProviderId", () => {
  it("prioritizes session provider over space provider", () => {
    expect(resolveModelProviderId("openai", "anthropic")).toBe("openai");
  });

  it("uses space provider when no session provider is set", () => {
    expect(resolveModelProviderId(undefined, "openai")).toBe("openai");
  });

  it("falls back to default provider when no selection exists", () => {
    expect(resolveModelProviderId(undefined, undefined)).toBe("anthropic");
    expect(resolveModelProviderId(undefined, undefined, "openai")).toBe("openai");
  });
});

function createMockAdapter(providerId: ModelProviderId): ProviderRuntimeAdapter {
  return {
    providerId,
    capabilities: {
      supportsApiKey: true,
      supportsTokenSession: true,
      supportsModelListing: true
    },
    resolveAuth: (_auth: ProviderAuthInput): ProviderAuthResolution => ({
      requestedMode: "api_key",
      resolvedMode: "api_key",
      status: "authenticated",
      fallbackApplied: false,
      failureCode: null,
      reason: null,
      apiKey: "test",
      tokenSessionId: null
    }),
    listModels: async () => [{ id: `${providerId}-model`, displayName: `${providerId} model` }],
    execute: async (request) => ({
      providerId,
      model: request.model,
      authMode: "api_key",
      text: "ok"
    })
  };
}
