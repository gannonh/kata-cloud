import type { ContextAdapter, ContextProvider, ContextProviderId, ContextQuery, ContextSnippet } from "./types";

type CreateContextAdapterInput = {
  providers: ContextProvider[];
  defaultProvider: ContextProviderId;
};

class DefaultContextAdapter implements ContextAdapter {
  constructor(
    private readonly providerMap: Map<ContextProviderId, ContextProvider>,
    private readonly defaultProvider: ContextProviderId
  ) {}

  async retrieve(query: ContextQuery, providerId: ContextProviderId): Promise<ContextSnippet[]> {
    const provider = this.providerMap.get(providerId) ?? this.providerMap.get(this.defaultProvider);
    if (!provider) {
      return [];
    }

    return provider.retrieve(query);
  }
}

export function createContextAdapter(input: CreateContextAdapterInput): ContextAdapter {
  const providerMap = new Map<ContextProviderId, ContextProvider>();
  for (const provider of input.providers) {
    providerMap.set(provider.id, provider);
  }

  return new DefaultContextAdapter(providerMap, input.defaultProvider);
}

export function resolveContextProviderId(
  spaceProvider: ContextProviderId | undefined,
  sessionProvider: ContextProviderId | undefined
): ContextProviderId {
  return sessionProvider ?? spaceProvider ?? "filesystem";
}
