import { mapProviderRuntimeError } from "./errors";
import type { ProviderRuntimeRegistry } from "./registry";
import type {
  ProviderModelDescriptor,
  ProviderExecuteResult,
  ProviderStatusRequest,
  ProviderStatusResult,
  ProviderListModelsIpcRequest,
  ProviderExecuteIpcRequest
} from "./types";

export class ProviderRuntimeService {
  constructor(private readonly registry: ProviderRuntimeRegistry) {}

  resolveAuth(request: ProviderStatusRequest): ProviderStatusResult {
    try {
      const adapter = this.registry.require(request.providerId);
      const resolution = adapter.resolveAuth(request.auth);
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
