import type {
  ContextAdapter,
  ContextProvider,
  ContextProviderId,
  ContextQuery,
  ContextRetrievalFailure,
  ContextRetrievalRequest,
  ContextRetrievalResult,
  ContextSnippet
} from "./types.js";

type CreateContextAdapterInput = {
  providers: ContextProvider[];
  defaultProvider: ContextProviderId;
};

class DefaultContextAdapter implements ContextAdapter {
  constructor(
    private readonly providerMap: Map<ContextProviderId, ContextProvider>,
    private readonly defaultProvider: ContextProviderId
  ) {}

  private toProviderUnavailableFailure(providerId: ContextProviderId): ContextRetrievalFailure {
    return {
      ok: false,
      providerId,
      snippets: [],
      error: {
        code: "provider_unavailable",
        message: `Context provider '${providerId}' is not configured.`,
        remediation: "Configure a supported context provider and retry.",
        retryable: true,
        providerId
      }
    };
  }

  private async retrieveResult(request: ContextRetrievalRequest): Promise<ContextRetrievalResult> {
    const requestedProvider = this.providerMap.get(request.providerId);
    const fallbackProvider = this.providerMap.get(this.defaultProvider);
    const provider = requestedProvider ?? fallbackProvider;
    const fallbackFromProviderId =
      requestedProvider || request.providerId === this.defaultProvider
        ? undefined
        : request.providerId;

    if (!provider) {
      return this.toProviderUnavailableFailure(request.providerId);
    }

    try {
      const result = await provider.retrieve(request);
      if (!fallbackFromProviderId) {
        return result;
      }
      return {
        ...result,
        fallbackFromProviderId
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected context provider failure.";
      return {
        ok: false,
        providerId: provider.id,
        snippets: [],
        fallbackFromProviderId,
        error: {
          code: "io_failure",
          message,
          remediation: "Inspect provider logs and retry context retrieval.",
          retryable: true,
          providerId: provider.id
        }
      };
    }
  }

  async retrieve(request: ContextRetrievalRequest): Promise<ContextRetrievalResult>;
  async retrieve(query: ContextQuery, providerId: ContextProviderId): Promise<ContextSnippet[]>;
  async retrieve(
    requestOrQuery: ContextRetrievalRequest | ContextQuery,
    providerId?: ContextProviderId
  ): Promise<ContextRetrievalResult | ContextSnippet[]> {
    if (providerId) {
      const query = requestOrQuery as ContextQuery;
      const result = await this.retrieveResult({
        ...query,
        providerId
      });
      return result.ok ? result.snippets : [];
    }

    return this.retrieveResult(requestOrQuery as ContextRetrievalRequest);
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
