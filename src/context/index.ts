export { createContextAdapter, resolveContextProviderId } from "./context-adapter";
export { FilesystemContextProvider } from "./providers/filesystem-context-provider";
export { McpCompatibleStubContextProvider } from "./providers/mcp-context-provider";
export type {
  ContextAdapter,
  ContextProvider,
  ContextProviderId,
  ContextQuery,
  ContextSnippet
} from "./types";
