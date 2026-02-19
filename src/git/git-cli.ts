import path from "node:path";
import { spawn } from "node:child_process";
import {
  ERROR_CODES,
  SpaceGitLifecycleError
} from "./space-git-errors.js";

export type GitCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type GitCommandRunner = (args: string[]) => Promise<GitCommandResult>;
export type GitDiffMode = "staged" | "unstaged";

export async function runGitCommand(args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr
      });
    });
  });
}

export class GitCli {
  private readonly commandRunner: GitCommandRunner;

  constructor(commandRunner: GitCommandRunner = runGitCommand) {
    this.commandRunner = commandRunner;
  }

  async isRepository(repoPath: string): Promise<boolean> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "rev-parse",
      "--is-inside-work-tree"
    ]);

    return result.exitCode === 0 && result.stdout.trim() === "true";
  }

  async isDirty(repoPath: string): Promise<boolean> {
    const status = await this.readStatusPorcelain(repoPath);
    return status.trim().length > 0;
  }

  async readStatusPorcelain(repoPath: string): Promise<string> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "status",
      "--porcelain"
    ]);

    this.assertSuccess(
      result,
      "Could not read repository status.",
      "Check repository permissions and git configuration."
    );

    return result.stdout;
  }

  async readStagedNumstat(repoPath: string): Promise<string> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "diff",
      "--cached",
      "--numstat"
    ]);

    this.assertSuccess(
      result,
      "Could not read staged diff summary.",
      "Check repository permissions and git configuration."
    );

    return result.stdout;
  }

  async readStagedDiff(repoPath: string): Promise<string> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "diff",
      "--cached"
    ]);

    this.assertSuccess(
      result,
      "Could not read staged diff.",
      "Check repository permissions and git configuration."
    );

    return result.stdout.trimEnd();
  }

  async branchExists(repoPath: string, branchName: string): Promise<boolean> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "show-ref",
      "--verify",
      "--quiet",
      `refs/heads/${branchName}`
    ]);

    return result.exitCode === 0;
  }

  async createBranch(repoPath: string, branchName: string): Promise<void> {
    const result = await this.commandRunner(["-C", repoPath, "branch", branchName]);

    this.assertSuccess(
      result,
      `Could not create branch "${branchName}".`,
      `Verify branch name "${branchName}" is valid and not protected.`
    );
  }

  async worktreeExists(repoPath: string, worktreePath: string): Promise<boolean> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "worktree",
      "list",
      "--porcelain"
    ]);

    this.assertSuccess(
      result,
      "Could not read git worktree list.",
      "Check repository permissions and git configuration."
    );

    const normalizedRequestedPath = path.resolve(worktreePath);
    const listedPaths = result.stdout
      .split("\n")
      .filter((line) => line.startsWith("worktree "))
      .map((line) => path.resolve(line.replace("worktree ", "").trim()));

    return listedPaths.includes(normalizedRequestedPath);
  }

  async addWorktree(
    repoPath: string,
    worktreePath: string,
    branchName: string
  ): Promise<void> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "worktree",
      "add",
      worktreePath,
      branchName
    ]);

    this.assertSuccess(
      result,
      `Could not create worktree at "${worktreePath}".`,
      "Ensure the target path is empty and writable."
    );
  }

  async switchBranch(worktreePath: string, branchName: string): Promise<void> {
    const result = await this.commandRunner([
      "-C",
      worktreePath,
      "switch",
      branchName
    ]);

    this.assertSuccess(
      result,
      `Could not switch worktree to branch "${branchName}".`,
      `Verify branch "${branchName}" exists and the worktree has no conflicting edits.`
    );
  }

  async currentBranch(worktreePath: string): Promise<string> {
    const result = await this.commandRunner([
      "-C",
      worktreePath,
      "branch",
      "--show-current"
    ]);

    this.assertSuccess(
      result,
      "Could not read current worktree branch.",
      "Open the worktree in git and resolve any repository configuration issues."
    );

    return result.stdout.trim();
  }

  async readRemoteUrl(repoPath: string, remoteName = "origin"): Promise<string> {
    const result = await this.commandRunner([
      "-C",
      repoPath,
      "remote",
      "get-url",
      remoteName
    ]);

    this.assertSuccess(
      result,
      `Could not read remote URL for "${remoteName}".`,
      "Ensure the remote exists and the repository is configured correctly."
    );

    return result.stdout.trim();
  }

  async readFileDiff(
    repoPath: string,
    filePath: string,
    mode: GitDiffMode
  ): Promise<string> {
    if (mode === "staged") {
      const stagedResult = await this.commandRunner([
        "-C",
        repoPath,
        "diff",
        "--cached",
        "--",
        filePath
      ]);

      this.assertSuccess(
        stagedResult,
        `Could not read staged diff for "${filePath}".`,
        "Check repository permissions and retry."
      );

      return stagedResult.stdout.trimEnd();
    }

    const unstagedResult = await this.commandRunner([
      "-C",
      repoPath,
      "diff",
      "--",
      filePath
    ]);

    this.assertSuccess(
      unstagedResult,
      `Could not read unstaged diff for "${filePath}".`,
      "Check repository permissions and retry."
    );

    if (unstagedResult.stdout.trim().length > 0) {
      return unstagedResult.stdout.trimEnd();
    }

    const untrackedResult = await this.commandRunner([
      "-C",
      repoPath,
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      filePath
    ]);

    this.assertSuccess(
      untrackedResult,
      `Could not verify untracked status for "${filePath}".`,
      "Check repository permissions and retry."
    );

    if (untrackedResult.stdout.trim().length === 0) {
      return "";
    }

    const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
    const untrackedDiff = await this.commandRunner([
      "-C",
      repoPath,
      "diff",
      "--no-index",
      "--",
      nullDevice,
      filePath
    ]);

    if (untrackedDiff.exitCode === 0 || untrackedDiff.exitCode === 1) {
      return untrackedDiff.stdout.trimEnd();
    }

    this.assertSuccess(
      untrackedDiff,
      `Could not read untracked diff for "${filePath}".`,
      "Check repository permissions and retry."
    );

    return "";
  }

  async stageFile(repoPath: string, filePath: string): Promise<void> {
    const result = await this.commandRunner(["-C", repoPath, "add", "--", filePath]);

    this.assertSuccess(
      result,
      `Could not stage "${filePath}".`,
      "Resolve file conflicts or permissions issues, then retry."
    );
  }

  async unstageFile(repoPath: string, filePath: string): Promise<void> {
    const restoreResult = await this.commandRunner([
      "-C",
      repoPath,
      "restore",
      "--staged",
      "--",
      filePath
    ]);

    if (restoreResult.exitCode === 0) {
      return;
    }

    const resetResult = await this.commandRunner([
      "-C",
      repoPath,
      "reset",
      "-q",
      "--",
      filePath
    ]);

    if (resetResult.exitCode === 0) {
      return;
    }

    this.assertSuccess(
      restoreResult,
      `Could not unstage "${filePath}".`,
      "Resolve file conflicts or permissions issues, then retry."
    );
  }

  private assertSuccess(
    result: GitCommandResult,
    message: string,
    remediation: string
  ): void {
    if (result.exitCode === 0) {
      return;
    }

    const detail = result.stderr.trim() || "Unknown git error";

    throw new SpaceGitLifecycleError({
      code: ERROR_CODES.GIT_COMMAND_FAILED,
      message: `${message} ${detail}`,
      remediation
    });
  }
}
