import { describe, expect, it } from "vitest";
import type { GitCli } from "./git-cli";
import { SpaceGitLifecycleService } from "./space-git-service";
import {
  createSpaceGitRequest,
  type SpaceGitLifecycleRequest
} from "./types";

function createFakeGit(
  overrides: Partial<{
    isRepository: (repoPath: string) => Promise<boolean>;
    isDirty: (repoPath: string) => Promise<boolean>;
    branchExists: (repoPath: string, branchName: string) => Promise<boolean>;
    createBranch: (repoPath: string, branchName: string) => Promise<void>;
    worktreeExists: (repoPath: string, worktreePath: string) => Promise<boolean>;
    addWorktree: (
      repoPath: string,
      worktreePath: string,
      branchName: string
    ) => Promise<void>;
    switchBranch: (worktreePath: string, branchName: string) => Promise<void>;
    currentBranch: (worktreePath: string) => Promise<string>;
    readStatusPorcelain: (repoPath: string) => Promise<string>;
    readStagedNumstat: (repoPath: string) => Promise<string>;
    readFileDiff: (
      repoPath: string,
      filePath: string,
      mode: "staged" | "unstaged"
    ) => Promise<string>;
    stageFile: (repoPath: string, filePath: string) => Promise<void>;
    unstageFile: (repoPath: string, filePath: string) => Promise<void>;
  }> = {}
) : GitCli {
  return {
    async isRepository() {
      return true;
    },
    async isDirty() {
      return false;
    },
    async branchExists() {
      return true;
    },
    async createBranch() {},
    async worktreeExists() {
      return true;
    },
    async addWorktree() {},
    async switchBranch() {},
    async currentBranch() {
      return "kata-space/feature-1234";
    },
    async readStatusPorcelain() {
      return "";
    },
    async readStagedNumstat() {
      return "";
    },
    async readFileDiff() {
      return "";
    },
    async stageFile() {},
    async unstageFile() {},
    ...overrides
  } as unknown as GitCli;
}

function createBaseRequest(): SpaceGitLifecycleRequest {
  return createSpaceGitRequest({
    spaceId: "space-1",
    spaceName: "Space One",
    repoPath: "/repo"
  });
}

describe("SpaceGitLifecycleService", () => {
  it("initializes branch/worktree and stores ready status", async () => {
    let branchCreated = false;
    let worktreeCreated = false;
    const request = createBaseRequest();
    const service = new SpaceGitLifecycleService({
      pathExists: async () => true,
      git: createFakeGit({
        async branchExists() {
          return false;
        },
        async createBranch() {
          branchCreated = true;
        },
        async worktreeExists() {
          return false;
        },
        async addWorktree() {
          worktreeCreated = true;
        }
      })
    });

    const result = await service.initializeSpace(request);

    expect(result.phase).toBe("ready");
    expect(branchCreated).toBe(true);
    expect(worktreeCreated).toBe(true);

    const uiStatus = service.getUiStatus(request.spaceId);
    expect(uiStatus.title).toBe("Git ready");
    expect(uiStatus.detail).toContain(request.branchName);
  });

  it("returns actionable error when repository path is missing", async () => {
    const request = createBaseRequest();
    const service = new SpaceGitLifecycleService({
      pathExists: async () => false,
      git: createFakeGit()
    });

    const result = await service.initializeSpace(request);

    expect(result.phase).toBe("error");
    expect(result.message).toContain("was not found");
    expect(result.remediation).toContain("Pick an existing repository path");
  });

  it("returns actionable error when repository is dirty", async () => {
    const request = createBaseRequest();
    const service = new SpaceGitLifecycleService({
      pathExists: async () => true,
      git: createFakeGit({
        async isDirty() {
          return true;
        }
      })
    });

    const result = await service.switchSpace(request);

    expect(result.phase).toBe("error");
    expect(result.message).toContain("uncommitted changes");
    expect(result.remediation).toContain("Commit or stash");
  });

  it("switches an existing worktree to the requested branch", async () => {
    const request = createBaseRequest();
    let addedWorktree = false;
    const service = new SpaceGitLifecycleService({
      pathExists: async () => true,
      git: createFakeGit({
        async worktreeExists() {
          return true;
        },
        async addWorktree() {
          addedWorktree = true;
        },
        async currentBranch() {
          return request.branchName;
        }
      })
    });

    const result = await service.switchSpace(request);

    expect(result.phase).toBe("ready");
    expect(result.message).toContain(`switched to ${request.branchName}`);
    expect(addedWorktree).toBe(false);
  });

  it("returns parsed change snapshot with staged summary", async () => {
    const service = new SpaceGitLifecycleService({
      pathExists: async () => true,
      git: createFakeGit({
        async readStatusPorcelain() {
          return ["M  src/staged.ts", "MM src/partial.ts", "?? src/new.ts"].join("\n");
        },
        async readStagedNumstat() {
          return ["3\t1\tsrc/staged.ts", "2\t0\tsrc/partial.ts"].join("\n");
        }
      })
    });

    const snapshot = await service.getChanges({ repoPath: "/repo" });

    expect(snapshot.files).toHaveLength(3);
    expect(snapshot.stagedFileCount).toBe(2);
    expect(snapshot.unstagedFileCount).toBe(2);
    expect(snapshot.stagedSummary.fileCount).toBe(2);
    expect(snapshot.stagedSummary.insertions).toBe(5);
    expect(snapshot.stagedSummary.deletions).toBe(1);
  });

  it("stages and unstages a selected file", async () => {
    let isStaged = false;
    const service = new SpaceGitLifecycleService({
      pathExists: async () => true,
      git: createFakeGit({
        async readStatusPorcelain() {
          return isStaged ? "M  src/app.ts" : " M src/app.ts";
        },
        async readStagedNumstat() {
          return isStaged ? "1\t0\tsrc/app.ts" : "";
        },
        async stageFile() {
          isStaged = true;
        },
        async unstageFile() {
          isStaged = false;
        }
      })
    });

    const staged = await service.stageFile({
      repoPath: "/repo",
      filePath: "src/app.ts"
    });
    expect(staged.stagedFileCount).toBe(1);
    expect(staged.unstagedFileCount).toBe(0);

    const unstaged = await service.unstageFile({
      repoPath: "/repo",
      filePath: "src/app.ts"
    });
    expect(unstaged.stagedFileCount).toBe(0);
    expect(unstaged.unstagedFileCount).toBe(1);
  });

  it("reads staged and unstaged diffs for a selected file", async () => {
    const service = new SpaceGitLifecycleService({
      pathExists: async () => true,
      git: createFakeGit({
        async readFileDiff(_repoPath, _filePath, mode) {
          return mode === "staged" ? "staged diff" : "unstaged diff";
        }
      })
    });

    const diff = await service.getFileDiff({
      repoPath: "/repo",
      filePath: "src/app.ts",
      includeStaged: true,
      includeUnstaged: true
    });

    expect(diff.stagedDiff).toBe("staged diff");
    expect(diff.unstagedDiff).toBe("unstaged diff");
  });
});
