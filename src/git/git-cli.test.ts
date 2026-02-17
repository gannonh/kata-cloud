import { describe, expect, it } from "vitest";
import { GitCli, type GitCommandResult } from "./git-cli";
import { SpaceGitLifecycleError } from "./space-git-errors";

function ok(stdout = "", stderr = ""): GitCommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr
  };
}

function fail(stderr = "fatal"): GitCommandResult {
  return {
    exitCode: 1,
    stdout: "",
    stderr
  };
}

function createRunner(...responses: GitCommandResult[]) {
  const queue = [...responses];
  const calls: string[][] = [];

  return {
    calls,
    runner: async (args: string[]) => {
      calls.push(args);
      const next = queue.shift();
      if (!next) {
        throw new Error("Unexpected git command call.");
      }

      return next;
    }
  };
}

describe("GitCli", () => {
  it("checks repository and dirty state", async () => {
    const command = createRunner(ok("true\n"), ok(" M src/app.ts\n"));
    const cli = new GitCli(command.runner);

    await expect(cli.isRepository("/repo")).resolves.toBe(true);
    await expect(cli.isDirty("/repo")).resolves.toBe(true);
    expect(command.calls).toEqual([
      ["-C", "/repo", "rev-parse", "--is-inside-work-tree"],
      ["-C", "/repo", "status", "--porcelain"]
    ]);
  });

  it("returns false for non-repository status output", async () => {
    const command = createRunner(ok("false\n"));
    const cli = new GitCli(command.runner);

    await expect(cli.isRepository("/repo")).resolves.toBe(false);
  });

  it("reads status, staged numstat, and staged diff", async () => {
    const command = createRunner(
      ok("MM src/app.ts\n"),
      ok("3\t1\tsrc/app.ts\n"),
      ok("diff --git a/src/app.ts b/src/app.ts\n")
    );
    const cli = new GitCli(command.runner);

    await expect(cli.readStatusPorcelain("/repo")).resolves.toBe("MM src/app.ts\n");
    await expect(cli.readStagedNumstat("/repo")).resolves.toBe("3\t1\tsrc/app.ts\n");
    await expect(cli.readStagedDiff("/repo")).resolves.toBe("diff --git a/src/app.ts b/src/app.ts");
  });

  it("reads a configured remote URL", async () => {
    const command = createRunner(ok("git@github.com:example/kata-cloud.git\n"));
    const cli = new GitCli(command.runner);

    await expect(cli.readRemoteUrl("/repo")).resolves.toBe("git@github.com:example/kata-cloud.git");
    expect(command.calls).toEqual([["-C", "/repo", "remote", "get-url", "origin"]]);
  });

  it("handles branch existence and branch creation", async () => {
    const command = createRunner(ok(), ok());
    const cli = new GitCli(command.runner);

    await expect(cli.branchExists("/repo", "feature/x")).resolves.toBe(true);
    await expect(cli.createBranch("/repo", "feature/x")).resolves.toBeUndefined();
    expect(command.calls).toEqual([
      ["-C", "/repo", "show-ref", "--verify", "--quiet", "refs/heads/feature/x"],
      ["-C", "/repo", "branch", "feature/x"]
    ]);
  });

  it("checks worktree existence using porcelain output", async () => {
    const target = "/repo-worktrees/space-1";
    const command = createRunner(
      ok(`worktree /repo\nHEAD deadbeef\n\nworktree ${target}\nHEAD cafe\n`)
    );
    const cli = new GitCli(command.runner);

    await expect(cli.worktreeExists("/repo", target)).resolves.toBe(true);
    expect(command.calls).toEqual([["-C", "/repo", "worktree", "list", "--porcelain"]]);
  });

  it("adds a worktree, switches branch, and reads current branch", async () => {
    const command = createRunner(ok(), ok(), ok("feature/x\n"));
    const cli = new GitCli(command.runner);

    await expect(cli.addWorktree("/repo", "/repo-worktrees/space-1", "feature/x")).resolves.toBeUndefined();
    await expect(cli.switchBranch("/repo-worktrees/space-1", "feature/x")).resolves.toBeUndefined();
    await expect(cli.currentBranch("/repo-worktrees/space-1")).resolves.toBe("feature/x");
  });

  it("reads staged file diff", async () => {
    const command = createRunner(ok("diff --git a/x b/x\n"));
    const cli = new GitCli(command.runner);

    await expect(cli.readFileDiff("/repo", "src/app.ts", "staged")).resolves.toBe("diff --git a/x b/x");
    expect(command.calls).toEqual([["-C", "/repo", "diff", "--cached", "--", "src/app.ts"]]);
  });

  it("reads unstaged file diff when working-tree diff exists", async () => {
    const command = createRunner(ok("diff --git a/x b/x\n"));
    const cli = new GitCli(command.runner);

    await expect(cli.readFileDiff("/repo", "src/app.ts", "unstaged")).resolves.toBe("diff --git a/x b/x");
    expect(command.calls).toEqual([["-C", "/repo", "diff", "--", "src/app.ts"]]);
  });

  it("returns empty string when unstaged file has no diff and is tracked", async () => {
    const command = createRunner(ok(""), ok(""));
    const cli = new GitCli(command.runner);

    await expect(cli.readFileDiff("/repo", "src/app.ts", "unstaged")).resolves.toBe("");
    expect(command.calls).toEqual([
      ["-C", "/repo", "diff", "--", "src/app.ts"],
      ["-C", "/repo", "ls-files", "--others", "--exclude-standard", "--", "src/app.ts"]
    ]);
  });

  it("uses no-index diff for untracked file content", async () => {
    const command = createRunner(ok(""), ok("src/new.ts\n"), { exitCode: 1, stdout: "new file diff\n", stderr: "" });
    const cli = new GitCli(command.runner);
    const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";

    await expect(cli.readFileDiff("/repo", "src/new.ts", "unstaged")).resolves.toBe("new file diff");
    expect(command.calls).toEqual([
      ["-C", "/repo", "diff", "--", "src/new.ts"],
      ["-C", "/repo", "ls-files", "--others", "--exclude-standard", "--", "src/new.ts"],
      ["-C", "/repo", "diff", "--no-index", "--", nullDevice, "src/new.ts"]
    ]);
  });

  it("stages and unstages files with restore-first flow", async () => {
    const command = createRunner(ok(), fail("restore failed"), ok());
    const cli = new GitCli(command.runner);

    await expect(cli.stageFile("/repo", "src/app.ts")).resolves.toBeUndefined();
    await expect(cli.unstageFile("/repo", "src/app.ts")).resolves.toBeUndefined();
    expect(command.calls).toEqual([
      ["-C", "/repo", "add", "--", "src/app.ts"],
      ["-C", "/repo", "restore", "--staged", "--", "src/app.ts"],
      ["-C", "/repo", "reset", "-q", "--", "src/app.ts"]
    ]);
  });

  it("throws lifecycle errors on git command failures", async () => {
    const command = createRunner(fail("status failed"));
    const cli = new GitCli(command.runner);

    await expect(cli.isDirty("/repo")).rejects.toBeInstanceOf(SpaceGitLifecycleError);
  });

  it("throws when unstage restore and reset both fail", async () => {
    const command = createRunner(fail("restore failed"), fail("reset failed"));
    const cli = new GitCli(command.runner);

    await expect(cli.unstageFile("/repo", "src/app.ts")).rejects.toBeInstanceOf(
      SpaceGitLifecycleError
    );
  });
});
