import { describe, expect, it } from "vitest";
import {
  createSpaceGitRequest,
  createSpaceGitStatus,
  isSpaceGitLifecycleStatus
} from "./types";

describe("createSpaceGitRequest", () => {
  it("builds deterministic branch and worktree targets for a space", () => {
    const request = createSpaceGitRequest({
      spaceId: "space-1234",
      spaceName: "Billing API",
      repoPath: "/tmp/billing"
    });

    expect(request.repoPath).toBe("/tmp/billing");
    expect(request.branchName).toBe("kata-space/billing-api-space123");
    expect(request.worktreePath).toBe("/tmp/billing-worktrees/space-1234");
  });
});

describe("isSpaceGitLifecycleStatus", () => {
  it("accepts valid lifecycle statuses", () => {
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

    expect(isSpaceGitLifecycleStatus(status)).toBe(true);
  });

  it("rejects invalid lifecycle statuses", () => {
    expect(
      isSpaceGitLifecycleStatus({
        phase: "ready",
        repoPath: "/repo"
      })
    ).toBe(false);
  });
});
