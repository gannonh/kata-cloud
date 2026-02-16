import { access } from "node:fs/promises";
import { GitCli, type GitCommandRunner } from "./git-cli";
import {
  ERROR_CODES,
  SpaceGitLifecycleError,
  isSpaceGitLifecycleError
} from "./space-git-errors";
import { toSpaceGitUiState } from "./space-git-ui-state";
import {
  createSpaceGitStatus,
  type SpaceGitLifecycleRequest,
  type SpaceGitLifecycleStatus
} from "./types";

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

type ServiceOptions = {
  git?: GitCli;
  commandRunner?: GitCommandRunner;
  pathExists?: (targetPath: string) => Promise<boolean>;
};

export class SpaceGitLifecycleService {
  private readonly git: GitCli;
  private readonly pathExistsFn: (targetPath: string) => Promise<boolean>;
  private readonly statusBySpace = new Map<string, SpaceGitLifecycleStatus>();

  constructor(options: ServiceOptions = {}) {
    this.git = options.git ?? new GitCli(options.commandRunner);
    this.pathExistsFn = options.pathExists ?? pathExists;
  }

  async initializeSpace(
    request: SpaceGitLifecycleRequest
  ): Promise<SpaceGitLifecycleStatus> {
    this.setStatus(
      request.spaceId,
      createSpaceGitStatus(
        request,
        "initializing",
        "Setting up branch and worktree."
      )
    );

    try {
      await this.assertRepositoryReady(request.repoPath);
      await this.ensureBranch(request.repoPath, request.branchName);
      await this.ensureWorktree(
        request.repoPath,
        request.worktreePath,
        request.branchName
      );
      await this.git.switchBranch(request.worktreePath, request.branchName);

      const status = createSpaceGitStatus(
        request,
        "ready",
        "Branch and worktree are ready for this space."
      );
      this.setStatus(request.spaceId, status);
      return status;
    } catch (error) {
      return this.setFailureStatus(request, error);
    }
  }

  async switchSpace(
    request: SpaceGitLifecycleRequest
  ): Promise<SpaceGitLifecycleStatus> {
    this.setStatus(
      request.spaceId,
      createSpaceGitStatus(
        request,
        "switching",
        "Switching branch and worktree."
      )
    );

    try {
      await this.assertRepositoryReady(request.repoPath);
      await this.ensureBranch(request.repoPath, request.branchName);
      await this.ensureWorktree(
        request.repoPath,
        request.worktreePath,
        request.branchName
      );
      await this.git.switchBranch(request.worktreePath, request.branchName);

      const currentBranch = await this.git.currentBranch(request.worktreePath);
      const status = createSpaceGitStatus(
        request,
        "ready",
        `Space switched to ${currentBranch}.`
      );
      this.setStatus(request.spaceId, status);
      return status;
    } catch (error) {
      return this.setFailureStatus(request, error);
    }
  }

  getSpaceStatus(spaceId: string): SpaceGitLifecycleStatus | null {
    return this.statusBySpace.get(spaceId) ?? null;
  }

  listStatuses(): Array<{ spaceId: string } & SpaceGitLifecycleStatus> {
    return Array.from(this.statusBySpace.entries()).map(([spaceId, status]) => ({
      spaceId,
      ...status
    }));
  }

  getUiStatus(spaceId: string) {
    return toSpaceGitUiState(this.getSpaceStatus(spaceId));
  }

  private async assertRepositoryReady(repoPath: string): Promise<void> {
    const repoPathExists = await this.pathExistsFn(repoPath);
    if (!repoPathExists) {
      throw new SpaceGitLifecycleError({
        code: ERROR_CODES.REPOSITORY_MISSING,
        message: `Repository path "${repoPath}" was not found.`,
        remediation:
          "Pick an existing repository path, or clone the repository before linking this space."
      });
    }

    const isRepository = await this.git.isRepository(repoPath);
    if (!isRepository) {
      throw new SpaceGitLifecycleError({
        code: ERROR_CODES.REPOSITORY_MISSING,
        message: `Path "${repoPath}" is not a git repository.`,
        remediation:
          "Run `git init` in that folder or select a different repository path."
      });
    }

    const isDirty = await this.git.isDirty(repoPath);
    if (isDirty) {
      throw new SpaceGitLifecycleError({
        code: ERROR_CODES.REPOSITORY_DIRTY,
        message: "Repository has uncommitted changes.",
        remediation:
          "Commit or stash changes in the repository before creating or switching a space worktree."
      });
    }
  }

  private async ensureBranch(repoPath: string, branchName: string): Promise<void> {
    const exists = await this.git.branchExists(repoPath, branchName);
    if (!exists) {
      await this.git.createBranch(repoPath, branchName);
    }
  }

  private async ensureWorktree(
    repoPath: string,
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    const exists = await this.git.worktreeExists(repoPath, worktreePath);
    if (!exists) {
      await this.git.addWorktree(repoPath, worktreePath, branchName);
    }
  }

  private setFailureStatus(
    request: SpaceGitLifecycleRequest,
    error: unknown
  ): SpaceGitLifecycleStatus {
    const lifecycleError = isSpaceGitLifecycleError(error)
      ? error
      : new SpaceGitLifecycleError({
          code: ERROR_CODES.GIT_COMMAND_FAILED,
          message: `Git setup failed: ${
            error instanceof Error ? error.message : "Unexpected error."
          }`,
          remediation: "Check git logs and retry setup for this space.",
          cause: error
        });

    const failureStatus = createSpaceGitStatus(
      request,
      "error",
      lifecycleError.message,
      lifecycleError.remediation
    );

    this.setStatus(request.spaceId, failureStatus);
    return failureStatus;
  }

  private setStatus(spaceId: string, status: SpaceGitLifecycleStatus): void {
    this.statusBySpace.set(spaceId, status);
  }
}
