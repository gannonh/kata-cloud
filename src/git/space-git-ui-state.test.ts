import { describe, expect, it } from "vitest";
import { toSpaceGitUiState } from "./space-git-ui-state";
import { createSpaceGitStatus } from "./types";

describe("toSpaceGitUiState", () => {
  it("returns unlinked state when git status is missing", () => {
    const uiState = toSpaceGitUiState(undefined);

    expect(uiState.title).toBe("Git not linked");
    expect(uiState.isError).toBe(false);
  });

  it("returns error state with remediation", () => {
    const status = createSpaceGitStatus(
      {
        spaceId: "space-1",
        repoPath: "/repo",
        branchName: "kata-space/feature-space1",
        worktreePath: "/repo-worktrees/space-1"
      },
      "error",
      "Repository has uncommitted changes.",
      "Commit or stash changes before retrying."
    );

    const uiState = toSpaceGitUiState(status);

    expect(uiState.isError).toBe(true);
    expect(uiState.remediation).toContain("Commit or stash");
  });
});
