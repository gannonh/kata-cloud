import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { AppState } from "../shared/state";
import { IPC_CHANNELS } from "../shared/shell-api";
import type { ProviderStatusRequest, ProviderListModelsIpcRequest, ProviderExecuteIpcRequest } from "../shared/shell-api";
import { PersistedStateStore } from "./persisted-state-store";
import { SpaceGitLifecycleService } from "../git/space-git-service";
import { PullRequestWorkflowService } from "../git/pr-workflow";
import type {
  GitHubSessionRequest,
  SpaceGitChangesRequest,
  SpaceGitCreatePullRequestRequest,
  SpaceGitFileDiffRequest,
  SpaceGitFileRequest,
  SpaceGitLifecycleRequest,
  SpaceGitPullRequestDraftRequest
} from "../git/types";
import { createContextAdapter } from "../context/context-adapter";
import { FilesystemContextProvider } from "../context/providers/filesystem-context-provider";
import { McpCompatibleStubContextProvider } from "../context/providers/mcp-context-provider";
import type { ContextRetrievalRequest } from "../context/types";
import { createProviderRuntimeRegistry } from "./provider-runtime/registry";
import { ProviderRuntimeService } from "./provider-runtime/service";
import { serializeProviderRuntimeError } from "./provider-runtime/errors";
import { AnthropicApiKeyClient, AnthropicProviderAdapter } from "./providers/anthropic";

let stateStore: PersistedStateStore | undefined;

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
      preload: path.join(__dirname, "../preload/index.js"),
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
        throw new Error("Context retrieval root path is not associated with a known space.");
      }

      return contextAdapter.retrieve({ ...request, rootPath: requestRootPath }, request.providerId);
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.providerResolveAuth,
    async (_event, request: ProviderStatusRequest) => {
      try {
        return await providerService.resolveAuth(request);
      } catch (error) {
        console.error("provider:resolve-auth failed", { providerId: request.providerId, error });
        throw serializeProviderRuntimeError(error);
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
        throw serializeProviderRuntimeError(error);
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
        throw serializeProviderRuntimeError(error);
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
  const providerRegistry = createProviderRuntimeRegistry([
    new AnthropicProviderAdapter(new AnthropicApiKeyClient())
  ]);
  const providerService = new ProviderRuntimeService(providerRegistry);
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
