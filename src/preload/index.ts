import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { AppState } from "../shared/state";
import type { ShellApi } from "../shared/shell-api";
import type { ProviderStatusRequest, ProviderListModelsIpcRequest, ProviderExecuteIpcRequest } from "../shared/shell-api";
import type { ContextRetrievalRequest, ContextRetrievalResult } from "../context/types";
import type {
  GitHubSessionRequest,
  SpaceGitChangesRequest,
  SpaceGitCreatePullRequestRequest,
  SpaceGitFileDiffRequest,
  SpaceGitFileRequest,
  SpaceGitLifecycleRequest,
  SpaceGitPullRequestDraftRequest
} from "../git/types";

// Keep this in sync with IPC_CHANNELS in src/shared/shell-api.ts.
// Do not runtime-import IPC_CHANNELS from preload in sandbox mode.
export const PRELOAD_IPC_CHANNELS = {
  getState: "kata-cloud/state:get",
  saveState: "kata-cloud/state:save",
  stateChanged: "kata-cloud/state:changed",
  initializeSpaceGit: "kata-cloud/space-git:initialize",
  switchSpaceGit: "kata-cloud/space-git:switch",
  getSpaceChanges: "kata-cloud/space-git:changes",
  getSpaceFileDiff: "kata-cloud/space-git:file-diff",
  stageSpaceFile: "kata-cloud/space-git:file-stage",
  unstageSpaceFile: "kata-cloud/space-git:file-unstage",
  createGitHubSession: "kata-cloud/github:session-create",
  clearGitHubSession: "kata-cloud/github:session-clear",
  generatePullRequestDraft: "kata-cloud/github:pr-draft",
  createPullRequest: "kata-cloud/github:pr-create",
  retrieveContext: "kata-cloud/context:retrieve",
  providerResolveAuth: "kata-cloud/provider:resolve-auth",
  providerListModels: "kata-cloud/provider:list-models",
  providerExecute: "kata-cloud/provider:execute",
  openExternalUrl: "kata-cloud/system:open-external-url"
} as const;

const shellApi: ShellApi = {
  getState: async () => ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.getState) as Promise<AppState>,
  saveState: async (nextState) => ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.saveState, nextState) as Promise<AppState>,
  subscribeState: (listener) => {
    const handler = (_event: IpcRendererEvent, nextState: AppState) => {
      listener(nextState);
    };

    ipcRenderer.on(PRELOAD_IPC_CHANNELS.stateChanged, handler);

    return () => {
      ipcRenderer.removeListener(PRELOAD_IPC_CHANNELS.stateChanged, handler);
    };
  },
  initializeSpaceGit: async (request: SpaceGitLifecycleRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.initializeSpaceGit, request),
  switchSpaceGit: async (request: SpaceGitLifecycleRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.switchSpaceGit, request),
  getSpaceChanges: async (request: SpaceGitChangesRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.getSpaceChanges, request),
  getSpaceFileDiff: async (request: SpaceGitFileDiffRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.getSpaceFileDiff, request),
  stageSpaceFile: async (request: SpaceGitFileRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.stageSpaceFile, request),
  unstageSpaceFile: async (request: SpaceGitFileRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.unstageSpaceFile, request),
  createGitHubSession: async (request: GitHubSessionRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.createGitHubSession, request),
  clearGitHubSession: async (sessionId: string) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.clearGitHubSession, sessionId),
  generatePullRequestDraft: async (request: SpaceGitPullRequestDraftRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.generatePullRequestDraft, request),
  createPullRequest: async (request: SpaceGitCreatePullRequestRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.createPullRequest, request),
  retrieveContext: async (request: ContextRetrievalRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.retrieveContext, request) as Promise<ContextRetrievalResult>,
  providerResolveAuth: async (request: ProviderStatusRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.providerResolveAuth, request),
  providerListModels: async (request: ProviderListModelsIpcRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.providerListModels, request),
  providerExecute: async (request: ProviderExecuteIpcRequest) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.providerExecute, request),
  openExternalUrl: async (url: string) =>
    ipcRenderer.invoke(PRELOAD_IPC_CHANNELS.openExternalUrl, url)
};

contextBridge.exposeInMainWorld("kataShell", shellApi);
