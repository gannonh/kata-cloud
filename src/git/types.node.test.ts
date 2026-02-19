import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createSpaceGitRequest,
  createSpaceGitStatus,
  isSpaceGitLifecycleStatus
} from "./types.js";

test("createSpaceGitRequest builds deterministic branch/worktree names", () => {
  const request = createSpaceGitRequest({
    spaceId: "space-1234",
    spaceName: "Billing API",
    repoPath: "/tmp/billing/"
  });

  assert.equal(request.repoPath, "/tmp/billing");
  assert.equal(request.branchName, "kata-space/billing-api-space123");
  assert.equal(request.worktreePath, "/tmp/billing-worktrees/space-1234");
});

test("isSpaceGitLifecycleStatus validates lifecycle status objects", () => {
  const status = createSpaceGitStatus(
    {
      spaceId: "space-1",
      repoPath: "/repo",
      branchName: "kata-space/feature-space1",
      worktreePath: "/repo-worktrees/space-1"
    },
    "ready",
    "ready"
  );

  assert.equal(isSpaceGitLifecycleStatus(status), true);
  assert.equal(
    isSpaceGitLifecycleStatus({
      phase: "ready",
      repoPath: "/repo"
    }),
    false
  );
});
