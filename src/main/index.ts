import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppState } from "../shared/state.js";
import { IPC_CHANNELS } from "../shared/shell-api.js";
import type { ProviderStatusRequest, ProviderListModelsIpcRequest, ProviderExecuteIpcRequest } from "../shared/shell-api.js";
import { PersistedStateStore } from "./persisted-state-store.js";
import { SpaceGitLifecycleService } from "../git/space-git-service.js";
import { PullRequestWorkflowService } from "../git/pr-workflow.js";
import type {
  GitHubSessionRequest,
  SpaceGitChangesRequest,
  SpaceGitCreatePullRequestRequest,
  SpaceGitFileDiffRequest,
  SpaceGitFileRequest,
  SpaceGitLifecycleRequest,
  SpaceGitPullRequestDraftRequest
} from "../git/types.js";
import { createContextAdapter } from "../context/context-adapter.js";
import { FilesystemContextProvider } from "../context/providers/filesystem-context-provider.js";
import { McpCompatibleStubContextProvider } from "../context/providers/mcp-context-provider.js";
import type { ContextRetrievalRequest } from "../context/types.js";
import { createProviderRuntimeRegistry, resolveProviderRuntimeMode } from "./provider-runtime/registry.js";
import { ProviderRuntimeService } from "./provider-runtime/service.js";
import { serializeProviderRuntimeError } from "./provider-runtime/errors.js";
import type { ModelProviderId, ProviderRuntimeAdapter, ProviderAuthInput } from "./provider-runtime/types.js";
import {
  createContextIpcErrorPayload,
  toContextRetrievalFailure
} from "../shared/context-ipc.js";
import { AnthropicProviderAdapter } from "./providers/anthropic/adapter.js";
import { AnthropicApiKeyClient } from "./providers/anthropic/api-key-client.js";
import { OpenAiProviderAdapter } from "./providers/openai/adapter.js";
import { OpenAiApiKeyClient } from "./providers/openai/api-key-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let stateStore: PersistedStateStore | undefined;

function createE2EProviderRuntimeAdapter(providerId: ModelProviderId): ProviderRuntimeAdapter {
  return {
    providerId,
    capabilities: {
      supportsApiKey: true,
      supportsTokenSession: false,
      supportsModelListing: true
    },
    resolveAuth(auth: ProviderAuthInput) {
      return {
        requestedMode: auth.preferredMode ?? "api_key",
        resolvedMode: "api_key",
        status: "authenticated",
        fallbackApplied: false,
        failureCode: null,
        reason: null,
        apiKey: auth.apiKey?.trim() || "kata-e2e-stub-key",
        tokenSessionId: null
      };
    },
    async listModels() {
      return [
        {
          id: providerId === "anthropic" ? "claude-e2e-stub" : "gpt-e2e-stub",
          displayName: providerId === "anthropic" ? "Claude E2E Stub" : "GPT E2E Stub"
        }
      ];
    },
    async execute(request) {
      const trimmedPrompt = request.prompt.trim();
      const summary = trimmedPrompt.length > 0 ? trimmedPrompt.slice(0, 120) : "No prompt provided.";
      return {
        providerId,
        model: request.model,
        authMode: "api_key",
        text: `E2E stub response (${providerId}): ${summary}`
      };
    }
  };
}

function broadcastState(nextState: AppState): void {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    browserWindow.webContents.send(IPC_CHANNELS.stateChanged, nextState);
  }
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: "Kata Cloud",
    backgroundColor: "#0f1116",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const rendererDevUrl = process.env.KATA_CLOUD_RENDERER_URL ?? "http://127.0.0.1:5173";
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../index.html")).catch((error) => {
      console.error("Unable to load packaged renderer page.", error);
    });
  } else {
    mainWindow.loadURL(rendererDevUrl).catch((error) => {
      console.error("Unable to load renderer dev server.", error);
    });
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (stateStore) {
      mainWindow.webContents.send(IPC_CHANNELS.stateChanged, stateStore.getState());
    }
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("Failed to execute preload script.", {
      preloadPath,
      error
    });
  });

  return mainWindow;
}

function registerStateHandlers(
  store: PersistedStateStore,
  gitLifecycleService: SpaceGitLifecycleService,
  pullRequestWorkflowService: PullRequestWorkflowService,
  providerService: ProviderRuntimeService
): void {
  const contextAdapter = createContextAdapter({
    providers: [new FilesystemContextProvider(), new McpCompatibleStubContextProvider()],
    defaultProvider: "filesystem"
  });

  ipcMain.handle(IPC_CHANNELS.getState, async () => store.getState());
  ipcMain.handle(IPC_CHANNELS.saveState, async (_event, nextState: unknown) => store.save(nextState));
  ipcMain.handle(
    IPC_CHANNELS.initializeSpaceGit,
    async (_event, request: SpaceGitLifecycleRequest) =>
      gitLifecycleService.initializeSpace(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.switchSpaceGit,
    async (_event, request: SpaceGitLifecycleRequest) =>
      gitLifecycleService.switchSpace(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.getSpaceChanges,
    async (_event, request: SpaceGitChangesRequest) =>
      gitLifecycleService.getChanges(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.getSpaceFileDiff,
    async (_event, request: SpaceGitFileDiffRequest) =>
      gitLifecycleService.getFileDiff(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.stageSpaceFile,
    async (_event, request: SpaceGitFileRequest) =>
      gitLifecycleService.stageFile(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.unstageSpaceFile,
    async (_event, request: SpaceGitFileRequest) =>
      gitLifecycleService.unstageFile(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.createGitHubSession,
    async (_event, request: GitHubSessionRequest) =>
      pullRequestWorkflowService.createGitHubSession(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.clearGitHubSession,
    async (_event, sessionId: string) =>
      pullRequestWorkflowService.clearGitHubSession(sessionId)
  );
  ipcMain.handle(
    IPC_CHANNELS.generatePullRequestDraft,
    async (_event, request: SpaceGitPullRequestDraftRequest) =>
      pullRequestWorkflowService.generatePullRequestDraft(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.createPullRequest,
    async (_event, request: SpaceGitCreatePullRequestRequest) =>
      pullRequestWorkflowService.createPullRequest(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.openExternalUrl,
    async (_event, url: string) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error("Invalid URL. Only HTTPS URLs are permitted.");
      }

      if (parsedUrl.protocol !== "https:") {
        throw new Error("Only HTTPS URLs are permitted.");
      }

      await shell.openExternal(parsedUrl.toString());
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.retrieveContext,
    async (_event, request: ContextRetrievalRequest) => {
      const requestRootPath =
        typeof request.rootPath === "string" ? request.rootPath.trim() : "";
      const knownRootPaths = new Set(
        store.getState().spaces.map((space) => space.rootPath.trim())
      );
      if (requestRootPath.length === 0 || !knownRootPaths.has(requestRootPath)) {
        console.warn("Rejected context retrieval for unknown root path.", {
          rootPath: requestRootPath,
          spaceId: request.spaceId,
          sessionId: request.sessionId
        });
        return toContextRetrievalFailure(
          createContextIpcErrorPayload({
            code: "invalid_root_path",
            message: "Context retrieval root path is not associated with a known space.",
            remediation: "Select a known space root path before running orchestration.",
            retryable: false,
            providerId: request.providerId
          })
        );
      }
      try {
        return await contextAdapter.retrieve({ ...request, rootPath: requestRootPath });
      } catch (error) {
        console.error("Context retrieval failed with unexpected runtime error.", error);
        return toContextRetrievalFailure(
          createContextIpcErrorPayload({
            code: "io_failure",
            message: "Context retrieval failed due to an unexpected runtime error.",
            remediation: "Retry context retrieval and inspect main-process logs if failure persists.",
            retryable: true,
            providerId: request.providerId
          })
        );
      }
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.providerResolveAuth,
    async (_event, request: ProviderStatusRequest) => {
      try {
        return await providerService.resolveAuth(request);
      } catch (error) {
        console.error("provider:resolve-auth failed", { providerId: request.providerId, error });
        throw serializeProviderRuntimeError(error, { runtimeMode: providerService.getMode() });
      }
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.providerListModels,
    async (_event, request: ProviderListModelsIpcRequest) => {
      try {
        return await providerService.listModels(request);
      } catch (error) {
        console.error("provider:list-models failed", { providerId: request.providerId, error });
        throw serializeProviderRuntimeError(error, { runtimeMode: providerService.getMode() });
      }
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.providerExecute,
    async (_event, request: ProviderExecuteIpcRequest) => {
      try {
        return await providerService.execute(request);
      } catch (error) {
        console.error("provider:execute failed", { providerId: request.providerId, error });
        throw serializeProviderRuntimeError(error, { runtimeMode: providerService.getMode() });
      }
    }
  );
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  stateStore = new PersistedStateStore((nextState) => {
    broadcastState(nextState);
  });
  const gitLifecycleService = new SpaceGitLifecycleService();
  const pullRequestWorkflowService = new PullRequestWorkflowService();
  const useE2EProviderStub = process.env.KATA_CLOUD_E2E_PROVIDER_STUB === "1";
  const providerRuntimeMode = resolveProviderRuntimeMode(process.env.KATA_CLOUD_PROVIDER_RUNTIME_MODE);
  const providerRegistry = createProviderRuntimeRegistry(
    useE2EProviderStub
      ? [createE2EProviderRuntimeAdapter("anthropic"), createE2EProviderRuntimeAdapter("openai")]
      : [
          new AnthropicProviderAdapter(new AnthropicApiKeyClient()),
          new OpenAiProviderAdapter(new OpenAiApiKeyClient())
        ]
  );
  const providerService = new ProviderRuntimeService(providerRegistry, {
    runtimeMode: providerRuntimeMode
  });
  console.log(`Provider runtime mode: ${providerService.getMode()}`);
  if (useE2EProviderStub) {
    console.log("Provider runtime adapters: e2e stubs");
  }
  await stateStore.initialize();

  registerStateHandlers(stateStore, gitLifecycleService, pullRequestWorkflowService, providerService);
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

bootstrap().catch((error) => {
  console.error("Failed to bootstrap Kata Cloud shell.", error);
  app.quit();
});
