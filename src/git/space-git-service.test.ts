import { describe, expect, it } from "vitest";
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
  }> = {}
) {
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
    ...overrides
  };
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
});
