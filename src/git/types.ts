export type SpaceGitLifecyclePhase = "initializing" | "switching" | "ready" | "error";

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

export interface SpaceGitLifecycle {
  initializeSpace: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
  switchSpace: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
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
