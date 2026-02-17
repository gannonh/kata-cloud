import { resolveProviderAuth } from "../../provider-runtime/auth";
import { createAuthResolutionError, mapProviderRuntimeError } from "../../provider-runtime/errors";
import type {
  ProviderAuthInput,
  ProviderAuthResolution,
  ProviderCapabilities,
  ProviderClientAuth,
  ProviderExecuteRequest,
  ProviderExecuteResult,
  ProviderListModelsRequest,
  ProviderModelDescriptor,
  ProviderRuntimeAdapter
} from "../../provider-runtime/types";

export interface OpenAiClientModel {
  id: string;
  displayName?: string;
}

export interface OpenAiClientExecuteResult {
  text: string;
  model?: string;
}

export interface OpenAiProviderClient {
  listModels(auth: ProviderClientAuth): Promise<OpenAiClientModel[]>;
  execute(request: {
    auth: ProviderClientAuth;
    model: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<OpenAiClientExecuteResult>;
}

export class OpenAiProviderAdapter implements ProviderRuntimeAdapter {
  readonly providerId = "openai" as const;
  readonly capabilities: ProviderCapabilities = {
    supportsApiKey: true,
    supportsTokenSession: true,
    supportsModelListing: true
  };

  constructor(private readonly client: OpenAiProviderClient) {}

  resolveAuth(auth: ProviderAuthInput): ProviderAuthResolution {
    return resolveProviderAuth({
      providerId: this.providerId,
      auth,
      supportsTokenSession: this.capabilities.supportsTokenSession
    });
  }

  async listModels(request: ProviderListModelsRequest): Promise<ProviderModelDescriptor[]> {
    const resolution = this.resolveAuth(request.auth);
    if (resolution.status !== "authenticated") {
      throw createAuthResolutionError(this.providerId, resolution);
    }

    try {
      const models = await this.client.listModels(toClientAuth(resolution));
      return models.map((model) => ({
        id: model.id,
        displayName: model.displayName ?? model.id
      }));
    } catch (error) {
      throw mapProviderRuntimeError(this.providerId, error);
    }
  }

  async execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
    const resolution = this.resolveAuth(request.auth);
    if (resolution.status !== "authenticated") {
      throw createAuthResolutionError(this.providerId, resolution);
    }
    const resolvedMode = resolution.resolvedMode;
    if (!resolvedMode) {
      throw createAuthResolutionError(this.providerId, resolution);
    }

    try {
      const result = await this.client.execute({
        auth: toClientAuth(resolution),
        model: request.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens,
        temperature: request.temperature
      });

      return {
        providerId: this.providerId,
        model: result.model ?? request.model,
        authMode: resolvedMode,
        text: result.text
      };
    } catch (error) {
      throw mapProviderRuntimeError(this.providerId, error);
    }
  }
}

function toClientAuth(resolution: ProviderAuthResolution): ProviderClientAuth {
  if (!resolution.resolvedMode) {
    throw new Error("Expected resolved auth mode for provider client request.");
  }

  return {
    authMode: resolution.resolvedMode,
    apiKey: resolution.apiKey ?? undefined,
    tokenSessionId: resolution.tokenSessionId ?? undefined
  };
}
