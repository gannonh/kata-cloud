import { createProviderRuntimeError } from "./errors";
import type { ModelProviderId, ProviderRuntimeAdapter } from "./types";

export interface ProviderRuntimeRegistry {
  register(adapter: ProviderRuntimeAdapter): void;
  get(providerId: ModelProviderId): ProviderRuntimeAdapter | undefined;
  require(providerId: ModelProviderId): ProviderRuntimeAdapter;
  list(): ProviderRuntimeAdapter[];
}

class DefaultProviderRuntimeRegistry implements ProviderRuntimeRegistry {
  private readonly adaptersById = new Map<ModelProviderId, ProviderRuntimeAdapter>();

  register(adapter: ProviderRuntimeAdapter): void {
    if (this.adaptersById.has(adapter.providerId)) {
      throw new Error(`Provider "${adapter.providerId}" is already registered.`);
    }

    this.adaptersById.set(adapter.providerId, adapter);
  }

  get(providerId: ModelProviderId): ProviderRuntimeAdapter | undefined {
    return this.adaptersById.get(providerId);
  }

  require(providerId: ModelProviderId): ProviderRuntimeAdapter {
    const adapter = this.adaptersById.get(providerId);
    if (!adapter) {
      throw createProviderRuntimeError({
        providerId,
        code: "provider_unavailable",
        message: `Provider "${providerId}" is not registered in this runtime.`,
        remediation: "Register the provider adapter before executing provider requests.",
        retryable: false
      });
    }

    return adapter;
  }

  list(): ProviderRuntimeAdapter[] {
    return [...this.adaptersById.values()];
  }
}

export function createProviderRuntimeRegistry(
  adapters: ProviderRuntimeAdapter[] = []
): ProviderRuntimeRegistry {
  const registry = new DefaultProviderRuntimeRegistry();
  for (const adapter of adapters) {
    registry.register(adapter);
  }
  return registry;
}

export function resolveModelProviderId(
  spaceProviderId: ModelProviderId | undefined,
  sessionProviderId: ModelProviderId | undefined,
  defaultProviderId: ModelProviderId = "anthropic"
): ModelProviderId {
  return sessionProviderId ?? spaceProviderId ?? defaultProviderId;
}
