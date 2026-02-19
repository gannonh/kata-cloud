import type { SpaceGitLifecycleStatus } from "./types.js";

export interface SpaceGitUiState {
  title: string;
  detail: string;
  branchName: string | null;
  worktreePath: string | null;
  remediation: string | null;
  isError: boolean;
}

export function toSpaceGitUiState(
  status: SpaceGitLifecycleStatus | null | undefined
): SpaceGitUiState {
  if (!status) {
    return {
      title: "Git not initialized",
      detail: "Workspace is available; initialize branch/worktree when you are ready.",
      branchName: null,
      worktreePath: null,
      remediation: "Set a valid workspace root path in space metadata to run git actions.",
      isError: false
    };
  }

  if (status.phase === "error") {
    return {
      title: "Git setup failed",
      detail: status.message,
      branchName: status.branchName,
      worktreePath: status.worktreePath,
      remediation: status.remediation,
      isError: true
    };
  }

  if (status.phase === "ready") {
    return {
      title: "Git ready",
      detail: `Branch ${status.branchName} in ${status.worktreePath}`,
      branchName: status.branchName,
      worktreePath: status.worktreePath,
      remediation: null,
      isError: false
    };
  }

  return {
    title: "Configuring git",
    detail: status.message,
    branchName: status.branchName,
    worktreePath: status.worktreePath,
    remediation: null,
    isError: false
  };
}
