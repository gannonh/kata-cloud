export { createContextAdapter, resolveContextProviderId } from "./context-adapter.js";
export { FilesystemContextProvider } from "./providers/filesystem-context-provider.js";
export { McpCompatibleStubContextProvider } from "./providers/mcp-context-provider.js";
export type {
  ContextAdapter,
  ContextProvider,
  ContextProviderId,
  ContextQuery,
  ContextSnippet
} from "./types.js";
