import type { AppState } from "./state";
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
} from "../git/types";
import type { ContextRetrievalRequest, ContextSnippet } from "../context/types";

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
  openExternalUrl: "kata-cloud/system:open-external-url"
} as const;

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
  retrieveContext: (request: ContextRetrievalRequest) => Promise<ContextSnippet[]>;
  openExternalUrl: (url: string) => Promise<void>;
}
