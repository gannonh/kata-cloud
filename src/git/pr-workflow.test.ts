import { describe, expect, it } from "vitest";
import { PullRequestWorkflowError, PullRequestWorkflowService, PR_WORKFLOW_ERROR_CODES, parseGitHubRepoReference } from "./pr-workflow";

function mockResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

describe("parseGitHubRepoReference", () => {
  it("supports HTTPS and SSH GitHub repository URLs", () => {
    expect(parseGitHubRepoReference("https://github.com/example/kata-cloud")).toEqual({
      owner: "example",
      repo: "kata-cloud"
    });
    expect(parseGitHubRepoReference("git@github.com:example/kata-cloud.git")).toEqual({
      owner: "example",
      repo: "kata-cloud"
    });
    expect(parseGitHubRepoReference("ssh://git@github.com/example/kata-cloud.git")).toEqual({
      owner: "example",
      repo: "kata-cloud"
    });
    expect(parseGitHubRepoReference("https://gitlab.com/example/kata-cloud")).toBeNull();
  });
});

describe("PullRequestWorkflowService", () => {
  it("generates suggested PR content from staged changes and spec context", async () => {
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "M  src/main.tsx\n",
      readStagedNumstat: async () => "8\t2\tsrc/main.tsx\n",
      readStagedDiff: async () => "diff --git a/src/main.tsx b/src/main.tsx\n+added line\n",
      currentBranch: async () => "feature/pr-workflow"
    };

    const service = new PullRequestWorkflowService({
      git: git as never,
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    const draft = await service.generatePullRequestDraft({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      specContext: "## Goal\nShip pull request workflow\n\n## Tasks\n- [ ] Add draft generation",
      baseBranch: "main"
    });

    expect(draft.headBranch).toBe("feature/pr-workflow");
    expect(draft.baseBranch).toBe("main");
    expect(draft.stagedFileCount).toBe(1);
    expect(draft.title).toContain("Ship pull request workflow");
    expect(draft.body).toContain("src/main.tsx");
    expect(draft.body).toContain("Spec Context");
    expect(draft.body).toContain("Diff Preview");
    expect(draft.body).toContain("Run relevant automated tests");
    expect(draft.body).toContain("Verify build/typecheck status");
  });

  it("redacts sensitive values and suppresses previews for sensitive file paths", async () => {
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "A  .env\nM  src/config.ts\n",
      readStagedNumstat: async () => "1\t0\t.env\n3\t1\tsrc/config.ts\n",
      readStagedDiff: async () =>
        [
          "diff --git a/.env b/.env",
          "new file mode 100644",
          "index 0000000..1111111",
          "--- /dev/null",
          "+++ b/.env",
          "@@ -0,0 +1 @@",
          "+API_KEY=sk-live-super-secret",
          "diff --git a/src/config.ts b/src/config.ts",
          "index 1111111..2222222 100644",
          "--- a/src/config.ts",
          "+++ b/src/config.ts",
          "@@ -1 +1,2 @@",
          '-const token = "old-token"',
          '+const token = "ghp_abcdefghijklmnopqrstuvwxyz123456"',
          '+const password = "ultra-secret-password"'
        ].join("\n"),
      currentBranch: async () => "feature/redaction-guardrails"
    };

    const service = new PullRequestWorkflowService({
      git: git as never,
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    const draft = await service.generatePullRequestDraft({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      specContext: "## Goal\nShip redaction guardrails",
      baseBranch: "main"
    });

    expect(draft.body).toContain("[diff preview suppressed: sensitive file path]");
    expect(draft.body).toContain('const token = "[REDACTED]"');
    expect(draft.body).toContain('const password = "[REDACTED]"');
    expect(draft.body).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(draft.body).not.toContain("ultra-secret-password");
    expect(draft.body).not.toContain("sk-live-super-secret");
  });

  it("suppresses sensitive files when diff headers use quoted paths", async () => {
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => 'A  "config dir/.env"\n',
      readStagedNumstat: async () => '1\t0\t"config dir/.env"\n',
      readStagedDiff: async () =>
        [
          'diff --git "a/config dir/.env" "b/config dir/.env"',
          "new file mode 100644",
          "index 0000000..1111111",
          "--- /dev/null",
          '+++ "b/config dir/.env"',
          "@@ -0,0 +1 @@",
          "+TOKEN=quoted-path-secret"
        ].join("\n"),
      currentBranch: async () => "feature/redaction-guardrails"
    };

    const service = new PullRequestWorkflowService({
      git: git as never,
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    const draft = await service.generatePullRequestDraft({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      specContext: "## Goal\nSupport quoted diff path suppression",
      baseBranch: "main"
    });

    expect(draft.body).toContain('diff --git "a/config dir/.env" "b/config dir/.env"');
    expect(draft.body).toContain("[diff preview suppressed: sensitive file path]");
    expect(draft.body).not.toContain("quoted-path-secret");
  });

  it("keeps diff preview truncated to fixed line and character limits", async () => {
    const largeDiffBody = Array.from({ length: 150 }, (_value, index) => `+line-${index.toString().padStart(3, "0")}`).join("\n");
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "M  src/large.ts\n",
      readStagedNumstat: async () => "150\t0\tsrc/large.ts\n",
      readStagedDiff: async () =>
        [
          "diff --git a/src/large.ts b/src/large.ts",
          "index 1111111..2222222 100644",
          "--- a/src/large.ts",
          "+++ b/src/large.ts",
          "@@ -1 +1,150 @@",
          largeDiffBody
        ].join("\n"),
      currentBranch: async () => "feature/redaction-guardrails"
    };

    const service = new PullRequestWorkflowService({
      git: git as never,
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    const draft = await service.generatePullRequestDraft({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      specContext: "## Goal\nShip diff truncation guardrails",
      baseBranch: "main"
    });

    expect(draft.body).toContain("+line-074");
    expect(draft.body).not.toContain("+line-120");
    expect(draft.body.length).toBeLessThan(4000);
  });

  it("appends an ellipsis when diff preview exceeds the character cap", async () => {
    const longLine = `+${"x".repeat(3500)}`;
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "M  src/very-long.ts\n",
      readStagedNumstat: async () => "1\t0\tsrc/very-long.ts\n",
      readStagedDiff: async () =>
        [
          "diff --git a/src/very-long.ts b/src/very-long.ts",
          "index 1111111..2222222 100644",
          "--- a/src/very-long.ts",
          "+++ b/src/very-long.ts",
          "@@ -1 +1 @@",
          longLine
        ].join("\n"),
      currentBranch: async () => "feature/redaction-guardrails"
    };

    const service = new PullRequestWorkflowService({
      git: git as never,
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    const draft = await service.generatePullRequestDraft({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      specContext: "## Goal\nShip truncation ellipsis behavior",
      baseBranch: "main"
    });

    expect(draft.body).toContain("…");
  });

  it("returns an actionable error when no staged changes exist", async () => {
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => " M src/main.tsx\n"
    };

    const service = new PullRequestWorkflowService({
      git: git as never,
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    await expect(
      service.generatePullRequestDraft({
        repoPath: "/repo",
        repoUrl: "https://github.com/example/kata-cloud",
        specContext: "## Goal\nShip pull request workflow"
      })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.NO_STAGED_CHANGES
    });
  });

  it("surfaces permission failures from GitHub API", async () => {
    const fetchCalls: string[] = [];
    const service = new PullRequestWorkflowService({
      pathExists: async () => true,
      git: {
        isRepository: async () => true,
        readRemoteUrl: async () => "git@github.com:example/kata-cloud.git",
        currentBranch: async () => "feature/pr-workflow"
      } as never,
      fetchFn: async (url) => {
        fetchCalls.push(url);
        if (url.endsWith("/user")) {
          return mockResponse(200, { login: "octocat" });
        }

        return mockResponse(403, { message: "Resource not accessible by personal access token" });
      }
    });

    const session = await service.createGitHubSession({ token: "ghp_test" });

    await expect(
      service.createPullRequest({
        repoPath: "/repo",
        repoUrl: "https://github.com/example/kata-cloud",
        sessionId: session.sessionId,
        title: "feat: test",
        body: "body",
        baseBranch: "main"
      })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.GITHUB_PERMISSION_DENIED
    });

    expect(fetchCalls.some((url) => url.includes("/repos/example/kata-cloud/pulls"))).toBe(true);
  });

  it("blocks submission when configured repo mismatches origin", async () => {
    const fetchCalls: string[] = [];
    const service = new PullRequestWorkflowService({
      pathExists: async () => true,
      git: {
        isRepository: async () => true,
        readRemoteUrl: async () => "git@github.com:other/repo.git",
        currentBranch: async () => "feature/pr-workflow"
      } as never,
      fetchFn: async (url) => {
        fetchCalls.push(url);
        return mockResponse(200, { login: "octocat" });
      }
    });

    const session = await service.createGitHubSession({ token: "ghp_test" });

    await expect(
      service.createPullRequest({
        repoPath: "/repo",
        repoUrl: "https://github.com/example/kata-cloud",
        sessionId: session.sessionId,
        title: "feat: test",
        body: "body",
        baseBranch: "main"
      })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.REPOSITORY_MISMATCH
    });

    expect(fetchCalls).toHaveLength(1);
  });

  it("creates pull requests and returns the created URL", async () => {
    const service = new PullRequestWorkflowService({
      pathExists: async () => true,
      git: {
        isRepository: async () => true,
        readRemoteUrl: async () => "git@github.com:example/kata-cloud.git",
        currentBranch: async () => "feature/pr-workflow"
      } as never,
      fetchFn: async (url) => {
        if (url.endsWith("/user")) {
          return mockResponse(200, { login: "octocat" });
        }

        return mockResponse(201, {
          html_url: "https://github.com/example/kata-cloud/pull/999",
          number: 999
        });
      }
    });

    const session = await service.createGitHubSession({ token: "ghp_test" });
    const result = await service.createPullRequest({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      sessionId: session.sessionId,
      title: "feat: ship workflow",
      body: "body",
      baseBranch: "main"
    });

    expect(result.url).toBe("https://github.com/example/kata-cloud/pull/999");
    expect(result.number).toBe(999);
    expect(result.headBranch).toBe("feature/pr-workflow");
    expect(result.baseBranch).toBe("main");
  });

  it("throws typed errors", async () => {
    const service = new PullRequestWorkflowService({
      pathExists: async () => false,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    await expect(
      service.generatePullRequestDraft({
        repoPath: "/missing",
        repoUrl: "https://github.com/example/kata-cloud",
        specContext: ""
      })
    ).rejects.toBeInstanceOf(PullRequestWorkflowError);
  });

  it("handles unknown GitHub session clear as a no-op", async () => {
    const service = new PullRequestWorkflowService({
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    await expect(service.clearGitHubSession("missing-session")).resolves.toBeUndefined();
    await expect(service.clearGitHubSession("" as unknown as string)).resolves.toBeUndefined();
  });

  it("returns typed validation errors for malformed auth payloads", async () => {
    const service = new PullRequestWorkflowService({
      pathExists: async () => true,
      fetchFn: async () => mockResponse(200, { login: "octocat" })
    });

    await expect(
      service.createGitHubSession({ token: 123 as unknown as string })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.AUTH_REQUIRED
    });
  });
});
