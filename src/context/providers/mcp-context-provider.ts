import type { ContextProvider, ContextQuery, ContextRetrievalResult } from "../types";

export class McpCompatibleStubContextProvider implements ContextProvider {
  readonly id = "mcp" as const;

  async retrieve(_query: ContextQuery): Promise<ContextRetrievalResult> {
    return {
      ok: false,
      providerId: this.id,
      snippets: [],
      error: {
        code: "provider_unavailable",
        message: "MCP context provider is not yet connected.",
        remediation: "Configure the MCP provider runtime before requesting MCP context.",
        retryable: true,
        providerId: this.id
      }
    };
  }
}
