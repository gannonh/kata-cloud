import { resolveProviderAuth, toClientAuth } from "../../provider-runtime/auth";
import {
  createAuthResolutionError,
  createProviderRuntimeError,
  mapProviderRuntimeError
} from "../../provider-runtime/errors";
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

export interface AnthropicClientModel {
  id: string;
  displayName?: string;
}

export interface AnthropicClientExecuteResult {
  text: string;
  model?: string;
}

export interface AnthropicProviderClient {
  listModels(auth: ProviderClientAuth): Promise<AnthropicClientModel[]>;
  execute(request: {
    auth: ProviderClientAuth;
    model: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AnthropicClientExecuteResult>;
}

export class AnthropicProviderAdapter implements ProviderRuntimeAdapter {
  readonly providerId = "anthropic" as const;
  readonly capabilities: ProviderCapabilities = {
    supportsApiKey: true,
    supportsTokenSession: false,
    supportsModelListing: true
  };

  constructor(private readonly client: AnthropicProviderClient) {}

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
    if (!resolution.resolvedMode) {
      throw createProviderRuntimeError({
        providerId: this.providerId,
        code: "unexpected_error",
        message: "Anthropic auth resolution did not return a resolved mode.",
        remediation: "Retry the request. If this persists, report the provider runtime issue.",
        retryable: false
      });
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
        authMode: resolution.resolvedMode,
        text: result.text
      };
    } catch (error) {
      throw mapProviderRuntimeError(this.providerId, error);
    }
  }
}
