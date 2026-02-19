import assert from "node:assert/strict";
import { test } from "vitest";
import type { GitCli } from "./git-cli.js";
import { SpaceGitLifecycleService } from "./space-git-service.js";
import { createSpaceGitRequest } from "./types.js";

function createFakeGit(overrides = {}): GitCli {
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
      return "kata-space/feature-space1";
    },
    ...overrides
  } as unknown as GitCli;
}

function createRequest() {
  return createSpaceGitRequest({
    spaceId: "space-1",
    spaceName: "Space One",
    repoPath: "/repo"
  });
}

test("initializeSpace creates missing branch/worktree and returns ready", async () => {
  let branchCreated = false;
  let worktreeCreated = false;
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

  const result = await service.initializeSpace(createRequest());
  assert.equal(result.phase, "ready");
  assert.equal(branchCreated, true);
  assert.equal(worktreeCreated, true);
});

test("switchSpace returns actionable error for dirty repo", async () => {
  const service = new SpaceGitLifecycleService({
    pathExists: async () => true,
    git: createFakeGit({
      async isDirty() {
        return true;
      }
    })
  });

  const result = await service.switchSpace(createRequest());
  assert.equal(result.phase, "error");
  assert.match(result.message, /uncommitted changes/i);
  assert.match(result.remediation ?? "", /Commit or stash/i);
});
