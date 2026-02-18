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

  it("falls back to default draft content when spec context is empty", async () => {
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "M  src/git/pr-workflow.ts\n",
      readStagedNumstat: async () => "2\t1\tsrc/git/pr-workflow.ts\n",
      readStagedDiff: async () => "diff --git a/src/git/pr-workflow.ts b/src/git/pr-workflow.ts\n+change\n",
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
      specContext: ""
    });

    expect(draft.title).toBe("feat: Update implementation based on staged changes");
    expect(draft.body).toContain("- No spec context provided.");
  });

  it("handles long and special-character spec context when building draft content", async () => {
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "M  src/main.tsx\n",
      readStagedNumstat: async () => "5\t4\tsrc/main.tsx\n",
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
      specContext: [
        "## Goal",
        "[Release] (v1) `Edge` workflow update with a very long summary line that should be truncated to keep title length bounded.",
        "",
        "## Tasks",
        "- [ ] checklist item",
        "- second bullet",
        "- third bullet",
        "- fourth bullet",
        "- fifth bullet"
      ].join("\n")
    });

    expect(draft.title.length).toBeLessThanOrEqual(72);
    expect(draft.title).toContain("feat: ");
    expect(draft.title).not.toMatch(/[\[\]()`]/);
    expect(draft.body).toContain("- [ ] checklist item");
    expect(draft.body).toContain("- second bullet");
    expect(draft.body).toContain("- third bullet");
    expect(draft.body).not.toContain("- fourth bullet");
  });

  it("limits diff preview to the first 80 lines of staged changes", async () => {
    const stagedDiff = Array.from({ length: 100 }, (_, index) => `+line-${String(index).padStart(3, "0")}`).join("\n");
    const git = {
      isRepository: async () => true,
      readStatusPorcelain: async () => "M  src/main.tsx\n",
      readStagedNumstat: async () => "100\t0\tsrc/main.tsx\n",
      readStagedDiff: async () => stagedDiff,
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
      specContext: "## Goal\nPreview limit check"
    });

    expect(draft.body).toContain("+line-000");
    expect(draft.body).toContain("+line-079");
    expect(draft.body).not.toContain("+line-080");
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

  it("invalidates cleared sessions while keeping other sessions active", async () => {
    const pullUrl = "https://github.com/example/kata-cloud/pull/321";
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

        return mockResponse(201, {
          html_url: pullUrl,
          number: 321
        });
      }
    });

    const firstSession = await service.createGitHubSession({ token: "ghp_first" });
    const secondSession = await service.createGitHubSession({ token: "ghp_second" });
    await service.clearGitHubSession(firstSession.sessionId);

    await expect(
      service.createPullRequest({
        repoPath: "/repo",
        repoUrl: "https://github.com/example/kata-cloud",
        sessionId: firstSession.sessionId,
        title: "feat: stale session",
        body: "body",
        baseBranch: "main"
      })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.AUTH_SESSION_MISSING
    });

    const result = await service.createPullRequest({
      repoPath: "/repo",
      repoUrl: "https://github.com/example/kata-cloud",
      sessionId: secondSession.sessionId,
      title: "feat: active session",
      body: "body",
      baseBranch: "main"
    });

    expect(result.url).toBe(pullUrl);
    expect(fetchCalls.filter((url) => url.includes("/repos/example/kata-cloud/pulls"))).toHaveLength(1);
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

  it("returns typed validation errors for malformed draft and create payloads", async () => {
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
        return mockResponse(200, { login: "octocat" });
      }
    });

    await expect(
      service.generatePullRequestDraft({
        repoPath: 123 as unknown as string,
        repoUrl: "https://github.com/example/kata-cloud",
        specContext: ""
      })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.GITHUB_VALIDATION_FAILED
    });

    const session = await service.createGitHubSession({ token: "ghp_test" });

    await expect(
      service.createPullRequest({
        repoPath: "/repo",
        repoUrl: "https://github.com/example/kata-cloud",
        sessionId: session.sessionId,
        title: "   ",
        body: 123 as unknown as string,
        baseBranch: "main"
      })
    ).rejects.toMatchObject({
      code: PR_WORKFLOW_ERROR_CODES.GITHUB_VALIDATION_FAILED
    });

    expect(fetchCalls.filter((url) => url.includes("/repos/example/kata-cloud/pulls"))).toHaveLength(0);
  });
});
