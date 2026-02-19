import type { AppState } from "./state.js";
import type {
  GitHubSessionInfo,
  GitHubSessionRequest,
  SpaceGitChangesRequest,
  SpaceGitChangesSnapshot,
  SpaceGitCreatePullRequestRequest,
  SpaceGitCreatePullRequestResult,
  SpaceGitFileDiffRequest,
  SpaceGitFileDiffResult,
  SpaceGitFileRequest,
  SpaceGitLifecycleRequest,
  SpaceGitLifecycleStatus,
  SpaceGitPullRequestDraftRequest,
  SpaceGitPullRequestDraftResult
} from "../git/types.js";
import type { ContextRetrievalRequest, ContextRetrievalResult } from "../context/types.js";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderRuntimeMode,
  ProviderModelDescriptor,
  ProviderExecuteResult,
  ProviderStatusRequest,
  ProviderStatusResult,
  ProviderListModelsIpcRequest,
  ProviderExecuteIpcRequest
} from "../main/provider-runtime/types.js";

export const IPC_CHANNELS = {
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
  providerGetRuntimeMode: "kata-cloud/provider:get-runtime-mode",
  providerExecute: "kata-cloud/provider:execute",
  openExternalUrl: "kata-cloud/system:open-external-url"
} as const;

// Re-exported so preload and renderer code can import all IPC types from the
// shared layer without reaching into src/main/provider-runtime/ directly.
export type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderRuntimeMode,
  ProviderStatusRequest,
  ProviderStatusResult,
  ProviderListModelsIpcRequest,
  ProviderExecuteIpcRequest,
  ProviderModelDescriptor,
  ProviderExecuteResult
};

export interface ShellApi {
  getState: () => Promise<AppState>;
  saveState: (nextState: AppState) => Promise<AppState>;
  subscribeState: (listener: (nextState: AppState) => void) => () => void;
  initializeSpaceGit: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
  switchSpaceGit: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
  getSpaceChanges: (
    request: SpaceGitChangesRequest
  ) => Promise<SpaceGitChangesSnapshot>;
  getSpaceFileDiff: (
    request: SpaceGitFileDiffRequest
  ) => Promise<SpaceGitFileDiffResult>;
  stageSpaceFile: (request: SpaceGitFileRequest) => Promise<SpaceGitChangesSnapshot>;
  unstageSpaceFile: (request: SpaceGitFileRequest) => Promise<SpaceGitChangesSnapshot>;
  createGitHubSession: (
    request: GitHubSessionRequest
  ) => Promise<GitHubSessionInfo>;
  clearGitHubSession: (sessionId: string) => Promise<void>;
  generatePullRequestDraft: (
    request: SpaceGitPullRequestDraftRequest
  ) => Promise<SpaceGitPullRequestDraftResult>;
  createPullRequest: (
    request: SpaceGitCreatePullRequestRequest
  ) => Promise<SpaceGitCreatePullRequestResult>;
  retrieveContext: (request: ContextRetrievalRequest) => Promise<ContextRetrievalResult>;
  providerResolveAuth: (request: ProviderStatusRequest) => Promise<ProviderStatusResult>;
  providerListModels: (request: ProviderListModelsIpcRequest) => Promise<ProviderModelDescriptor[]>;
  providerGetRuntimeMode: () => Promise<ProviderRuntimeMode>;
  providerExecute: (request: ProviderExecuteIpcRequest) => Promise<ProviderExecuteResult>;
  openExternalUrl: (url: string) => Promise<void>;
}
