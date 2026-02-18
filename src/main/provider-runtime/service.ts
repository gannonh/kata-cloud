import { mapProviderRuntimeError } from "./errors";
import type { ProviderRuntimeRegistry } from "./registry";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderAuthMode,
  ProviderAuthFailureCode,
  ProviderModelDescriptor,
  ProviderExecuteResult
} from "./types";

export interface ProviderStatusRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export interface ProviderStatusResult {
  providerId: ModelProviderId;
  resolvedMode: ProviderAuthMode | null;
  status: "authenticated" | "error";
  fallbackApplied: boolean;
  failureCode: ProviderAuthFailureCode | null;
  reason: string | null;
}

export interface ProviderListModelsIpcRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export interface ProviderExecuteIpcRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ProviderRuntimeService {
  constructor(private readonly registry: ProviderRuntimeRegistry) {}

  resolveAuth(request: ProviderStatusRequest): ProviderStatusResult {
    try {
      const adapter = this.registry.require(request.providerId);
      const resolution = adapter.resolveAuth(request.auth);
      return {
        providerId: request.providerId,
        resolvedMode: resolution.resolvedMode,
        status: resolution.status,
        fallbackApplied: resolution.fallbackApplied,
        failureCode: resolution.failureCode,
        reason: resolution.reason
      };
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }

  async listModels(request: ProviderListModelsIpcRequest): Promise<ProviderModelDescriptor[]> {
    try {
      const adapter = this.registry.require(request.providerId);
      return await adapter.listModels({ auth: request.auth });
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }

  async execute(request: ProviderExecuteIpcRequest): Promise<ProviderExecuteResult> {
    try {
      const adapter = this.registry.require(request.providerId);
      return await adapter.execute({
        auth: request.auth,
        model: request.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens,
        temperature: request.temperature
      });
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }
}
