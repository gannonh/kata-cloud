export type ContextProviderId = "filesystem" | "mcp";
export type ContextRetrievalErrorCode =
  | "provider_unavailable"
  | "unsupported_provider"
  | "invalid_query"
  | "invalid_root_path"
  | "io_failure";

export interface ContextQuery {
  prompt: string;
  spaceId: string;
  sessionId: string;
  rootPath: string;
  limit?: number;
}

export interface ContextRetrievalRequest extends ContextQuery {
  providerId: ContextProviderId;
}

export interface ContextSnippet {
  id: string;
  provider: ContextProviderId;
  path: string;
  source: string;
  content: string;
  score: number;
}

export interface ContextRetrievalError {
  code: ContextRetrievalErrorCode;
  message: string;
  remediation: string;
  retryable: boolean;
  providerId: ContextProviderId;
}

export interface ContextRetrievalSuccess {
  ok: true;
  providerId: ContextProviderId;
  snippets: ContextSnippet[];
  fallbackFromProviderId?: ContextProviderId;
}

export interface ContextRetrievalFailure {
  ok: false;
  providerId: ContextProviderId;
  snippets: ContextSnippet[];
  fallbackFromProviderId?: ContextProviderId;
  error: ContextRetrievalError;
}

export type ContextRetrievalResult = ContextRetrievalSuccess | ContextRetrievalFailure;

export interface ContextProvider {
  readonly id: ContextProviderId;
  retrieve(query: ContextQuery): Promise<ContextRetrievalResult>;
}

export interface ContextAdapter {
  retrieve(request: ContextRetrievalRequest): Promise<ContextRetrievalResult>;
  retrieve(query: ContextQuery, providerId: ContextProviderId): Promise<ContextSnippet[]>;
}
