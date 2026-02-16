import type { SpaceGitLifecycleStatus } from "./types";

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
      title: "Git not linked",
      detail: "Link a repository to set up an isolated branch and worktree.",
      branchName: null,
      worktreePath: null,
      remediation: "Select a repository path when creating or editing the space.",
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
