import { createProviderRuntimeError, mapProviderRuntimeError } from "./errors.js";
import type { ProviderRuntimeRegistry } from "./registry.js";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderAuthMode,
  ProviderModelDescriptor,
  ProviderExecuteResult,
  ProviderRuntimeMode,
  ProviderStatusRequest,
  ProviderStatusResult,
  ProviderListModelsIpcRequest,
  ProviderExecuteIpcRequest
} from "./types.js";

interface ProviderRuntimeServiceOptions {
  runtimeMode?: ProviderRuntimeMode;
}

export class ProviderRuntimeService {
  private readonly runtimeMode: ProviderRuntimeMode;

  constructor(
    private readonly registry: ProviderRuntimeRegistry,
    options: ProviderRuntimeServiceOptions = {}
  ) {
    this.runtimeMode = options.runtimeMode ?? "native";
  }

  getMode(): ProviderRuntimeMode {
    return this.runtimeMode;
  }

  resolveAuth(request: ProviderStatusRequest): ProviderStatusResult {
    try {
      const adapter = this.registry.require(request.providerId);
      const resolution = adapter.resolveAuth(withEnvApiKey(request.providerId, request.auth));
      if (resolution.status === "authenticated") {
        return {
          providerId: request.providerId,
          status: "authenticated",
          requestedMode: resolution.requestedMode,
          resolvedMode: resolution.resolvedMode as NonNullable<typeof resolution.resolvedMode>,
          fallbackApplied: resolution.fallbackApplied
        };
      }
      return {
        providerId: request.providerId,
        status: "error",
        requestedMode: resolution.requestedMode,
        resolvedMode: null,
        fallbackApplied: resolution.fallbackApplied,
        failureCode: resolution.failureCode ?? "missing_auth",
        reason: resolution.reason
      };
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }

  async listModels(request: ProviderListModelsIpcRequest): Promise<ProviderModelDescriptor[]> {
    try {
      if (this.runtimeMode === "pi") {
        return await listPiModels(request.providerId);
      }

      const adapter = this.registry.require(request.providerId);
      return await adapter.listModels({
        auth: withEnvApiKey(request.providerId, request.auth)
      });
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }

  async execute(request: ProviderExecuteIpcRequest): Promise<ProviderExecuteResult> {
    try {
      const auth = withEnvApiKey(request.providerId, request.auth);
      if (this.runtimeMode === "pi") {
        const piResult = await executeWithPi({
          ...request,
          auth
        });
        return { ...piResult, runtimeMode: "pi" };
      }

      const adapter = this.registry.require(request.providerId);
      const nativeResult = await adapter.execute({
        auth,
        model: request.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens,
        temperature: request.temperature
      });
      return { ...nativeResult, runtimeMode: "native" };
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }
}

function withEnvApiKey(providerId: ModelProviderId, auth: ProviderAuthInput): ProviderAuthInput {
  if (auth.apiKey && auth.apiKey.trim().length > 0) {
    return auth;
  }

  const envApiKey = resolveProviderApiKeyFromEnv(providerId);
  if (!envApiKey) {
    return auth;
  }

  return {
    ...auth,
    apiKey: envApiKey
  };
}

function resolveProviderApiKeyFromEnv(providerId: ModelProviderId): string | null {
  const raw = providerId === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

async function listPiModels(providerId: ModelProviderId): Promise<ProviderModelDescriptor[]> {
  const piAi = await import("@mariozechner/pi-ai");
  const models = piAi.getModels(providerId as Parameters<typeof piAi.getModels>[0]);
  return models.map((model) => ({
    id: model.id,
    displayName: model.name
  }));
}

async function executeWithPi(request: ProviderExecuteIpcRequest): Promise<ProviderExecuteResult> {
  const authMode = resolvePiAuthMode(request.auth);
  const apiKey = request.auth.apiKey?.trim();
  if (!apiKey) {
    throw createProviderRuntimeError({
      providerId: request.providerId,
      code: "missing_auth",
      message: `${request.providerId} API key is required for PI runtime mode.`,
      remediation: "Configure provider API key (or corresponding env var) and retry.",
      retryable: false
    });
  }

  const piAi = await import("@mariozechner/pi-ai");
  const models = piAi.getModels(request.providerId as Parameters<typeof piAi.getModels>[0]);
  const model = models.find((entry) => entry.id === request.model) ?? models[0];
  if (!model) {
    throw createProviderRuntimeError({
      providerId: request.providerId,
      code: "provider_unavailable",
      message: `No PI models are available for provider "${request.providerId}".`,
      remediation: "Switch runtime mode to native or configure PI provider support.",
      retryable: false
    });
  }

  const result = await piAi.complete(
    model,
    {
      systemPrompt: request.systemPrompt,
      messages: [
        {
          role: "user",
          content: request.prompt,
          timestamp: Date.now()
        }
      ]
    },
    {
      apiKey,
      maxTokens: request.maxTokens,
      temperature: request.temperature
    }
  );

  const text = result.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n\n")
    .trim();
  if (text.length === 0) {
    throw createProviderRuntimeError({
      providerId: request.providerId,
      code: "unexpected_error",
      message: "PI runtime returned an empty completion payload.",
      remediation: "Retry with additional prompt context or switch to native runtime mode.",
      retryable: true
    });
  }

  return {
    providerId: request.providerId,
    model: model.id,
    authMode,
    text
  };
}

function resolvePiAuthMode(auth: ProviderAuthInput): ProviderAuthMode {
  void auth;
  return "api_key";
}
