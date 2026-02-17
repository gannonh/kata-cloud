import type { ContextProvider, ContextQuery, ContextSnippet } from "../types";

export class McpCompatibleStubContextProvider implements ContextProvider {
  readonly id = "mcp" as const;

  async retrieve(_query: ContextQuery): Promise<ContextSnippet[]> {
    return [];
  }
}
