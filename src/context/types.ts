export type ContextProviderId = "filesystem" | "mcp";

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

export interface ContextProvider {
  readonly id: ContextProviderId;
  retrieve(query: ContextQuery): Promise<ContextSnippet[]>;
}

export interface ContextAdapter {
  retrieve(query: ContextQuery, providerId: ContextProviderId): Promise<ContextSnippet[]>;
}
