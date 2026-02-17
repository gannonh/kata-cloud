export type SpaceGitLifecyclePhase = "initializing" | "switching" | "ready" | "error";
export type SpaceGitFileStatusCode = "M" | "A" | "D" | "R" | "C" | "U" | "?";

export interface SpaceGitLifecycleRequest {
  spaceId: string;
  repoPath: string;
  branchName: string;
  worktreePath: string;
}

export interface SpaceGitLifecycleStatus extends SpaceGitLifecycleRequest {
  phase: SpaceGitLifecyclePhase;
  message: string;
  remediation: string | null;
  updatedAt: string;
}

export interface SpaceGitChangesRequest {
  repoPath: string;
}

export interface SpaceGitFileRequest extends SpaceGitChangesRequest {
  filePath: string;
}

export interface SpaceGitFileDiffRequest extends SpaceGitFileRequest {
  includeStaged: boolean;
  includeUnstaged: boolean;
}

export interface GitHubSessionRequest {
  token: string;
}

export interface GitHubSessionInfo {
  sessionId: string;
  login: string;
  createdAt: string;
}

export interface SpaceGitPullRequestDraftRequest extends SpaceGitChangesRequest {
  repoUrl: string;
  specContext: string;
  baseBranch?: string;
}

export interface SpaceGitPullRequestDraftResult {
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  stagedFileCount: number;
  updatedAt: string;
}

export interface SpaceGitCreatePullRequestRequest extends SpaceGitChangesRequest {
  repoUrl: string;
  sessionId: string;
  title: string;
  body: string;
  baseBranch: string;
}

export interface SpaceGitCreatePullRequestResult {
  url: string;
  number: number;
  title: string;
  headBranch: string;
  baseBranch: string;
  updatedAt: string;
}

export interface SpaceGitChangeFile {
  path: string;
  previousPath: string | null;
  statusCode: string;
  stagedStatus: SpaceGitFileStatusCode | null;
  unstagedStatus: SpaceGitFileStatusCode | null;
  isConflicted: boolean;
}

export interface SpaceGitStagedSummary {
  fileCount: number;
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
  copied: number;
  conflicted: number;
  insertions: number;
  deletions: number;
}

export interface SpaceGitChangesSnapshot extends SpaceGitChangesRequest {
  files: SpaceGitChangeFile[];
  stagedSummary: SpaceGitStagedSummary;
  stagedFileCount: number;
  unstagedFileCount: number;
  hasStagedChanges: boolean;
  updatedAt: string;
}

export interface SpaceGitFileDiffResult extends SpaceGitFileRequest {
  stagedDiff: string | null;
  unstagedDiff: string | null;
  updatedAt: string;
}

export interface SpaceGitLifecycle {
  initializeSpace: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
  switchSpace: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
  getChanges: (
    request: SpaceGitChangesRequest
  ) => Promise<SpaceGitChangesSnapshot>;
  getFileDiff: (
    request: SpaceGitFileDiffRequest
  ) => Promise<SpaceGitFileDiffResult>;
  stageFile: (request: SpaceGitFileRequest) => Promise<SpaceGitChangesSnapshot>;
  unstageFile: (request: SpaceGitFileRequest) => Promise<SpaceGitChangesSnapshot>;
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
}

export function createSpaceGitStatus(
  request: SpaceGitLifecycleRequest,
  phase: SpaceGitLifecyclePhase,
  message: string,
  remediation: string | null = null
): SpaceGitLifecycleStatus {
  return {
    ...request,
    phase,
    message,
    remediation,
    updatedAt: new Date().toISOString()
  };
}

type SpaceGitRequestInput = {
  spaceId: string;
  spaceName: string;
  repoPath: string;
};

export function createSpaceGitRequest(
  input: SpaceGitRequestInput
): SpaceGitLifecycleRequest {
  const repoPath = normalizePath(input.repoPath);
  const separator = repoPath.includes("\\") ? "\\" : "/";
  const branchSuffix = input.spaceId
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase()
    .slice(0, 8);

  return {
    spaceId: input.spaceId,
    repoPath,
    branchName: `kata-space/${slugify(input.spaceName)}-${branchSuffix || "space"}`,
    worktreePath: `${repoPath}-worktrees${separator}${input.spaceId}`
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "space";
}

function normalizePath(value: string): string {
  return value.trim().replace(/[\\/]+$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSpaceGitLifecycleStatus(
  value: unknown
): value is SpaceGitLifecycleStatus {
  if (!isObject(value)) {
    return false;
  }

  const remediationIsValid =
    value.remediation === null || typeof value.remediation === "string";

  const validPhase =
    value.phase === "initializing" ||
    value.phase === "switching" ||
    value.phase === "ready" ||
    value.phase === "error";

  return (
    validPhase &&
    typeof value.spaceId === "string" &&
    typeof value.repoPath === "string" &&
    typeof value.branchName === "string" &&
    typeof value.worktreePath === "string" &&
    typeof value.message === "string" &&
    remediationIsValid &&
    typeof value.updatedAt === "string"
  );
}
