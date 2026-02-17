import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { isStagedFileChange, parseGitStatusPorcelain, summarizeStagedChanges } from "./changes";
import { GitCli, type GitCommandRunner } from "./git-cli";
import type {
  GitHubSessionInfo,
  GitHubSessionRequest,
  SpaceGitCreatePullRequestRequest,
  SpaceGitCreatePullRequestResult,
  SpaceGitPullRequestDraftRequest,
  SpaceGitPullRequestDraftResult
} from "./types";

type GitHubFetch = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

type GitHubRepoRef = {
  owner: string;
  repo: string;
};

type GitHubSessionRecord = {
  sessionId: string;
  token: string;
  login: string;
  createdAt: string;
};

type ServiceOptions = {
  git?: GitCli;
  commandRunner?: GitCommandRunner;
  pathExists?: (targetPath: string) => Promise<boolean>;
  fetchFn?: GitHubFetch;
  apiBaseUrl?: string;
};

const GITHUB_API_BASE_URL = "https://api.github.com";

export const PR_WORKFLOW_ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  AUTH_SESSION_MISSING: "AUTH_SESSION_MISSING",
  REPOSITORY_MISSING: "REPOSITORY_MISSING",
  REPOSITORY_BRANCH_MISSING: "REPOSITORY_BRANCH_MISSING",
  REPOSITORY_MISMATCH: "REPOSITORY_MISMATCH",
  NO_STAGED_CHANGES: "NO_STAGED_CHANGES",
  INVALID_REPOSITORY_URL: "INVALID_REPOSITORY_URL",
  GITHUB_PERMISSION_DENIED: "GITHUB_PERMISSION_DENIED",
  GITHUB_REPOSITORY_NOT_FOUND: "GITHUB_REPOSITORY_NOT_FOUND",
  GITHUB_VALIDATION_FAILED: "GITHUB_VALIDATION_FAILED",
  GITHUB_API_FAILED: "GITHUB_API_FAILED"
} as const;

export type PullRequestWorkflowErrorCode =
  (typeof PR_WORKFLOW_ERROR_CODES)[keyof typeof PR_WORKFLOW_ERROR_CODES];

export class PullRequestWorkflowError extends Error {
  readonly code: PullRequestWorkflowErrorCode;
  readonly remediation: string;

  constructor(code: PullRequestWorkflowErrorCode, message: string, remediation: string) {
    super(message);
    this.name = "PullRequestWorkflowError";
    this.code = code;
    this.remediation = remediation;
  }
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function parseGitHubRepoReference(repoUrl: string): GitHubRepoRef | null {
  const normalized = repoUrl.trim();
  if (normalized.length === 0) {
    return null;
  }

  const httpsMatch = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (httpsMatch) {
    const owner = httpsMatch[1]?.trim();
    const repo = httpsMatch[2]?.trim();
    if (owner && repo) {
      return { owner, repo };
    }
  }

  const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    const owner = sshMatch[1]?.trim();
    const repo = sshMatch[2]?.trim();
    if (owner && repo) {
      return { owner, repo };
    }
  }

  const sshProtocolMatch = normalized.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (sshProtocolMatch) {
    const owner = sshProtocolMatch[1]?.trim();
    const repo = sshProtocolMatch[2]?.trim();
    if (owner && repo) {
      return { owner, repo };
    }
  }

  return null;
}

function summarizeSpecContext(specContext: string): string[] {
  const lines = specContext
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("---"));

  const summary: string[] = [];
  const ignoredHeadings = new Set([
    "goal",
    "goals",
    "task",
    "tasks",
    "acceptance criteria",
    "verification",
    "verification plan"
  ]);
  for (const line of lines) {
    const normalized = line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim();
    if (normalized.length === 0) {
      continue;
    }
    if (ignoredHeadings.has(normalized.toLowerCase())) {
      continue;
    }
    summary.push(normalized);
    if (summary.length >= 4) {
      break;
    }
  }

  return summary;
}

function toSingleLineSummary(specContext: string): string {
  const summary = summarizeSpecContext(specContext);
  return summary[0] ?? "Update implementation based on staged changes";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildSuggestedTitle(specContext: string, stagedFileCount: number): string {
  const summary = toSingleLineSummary(specContext)
    .replace(/[()[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (summary.length > 0) {
    return truncate(`feat: ${summary}`, 72);
  }

  return truncate(`feat: update ${stagedFileCount} staged file(s)`, 72);
}

function formatSpecSummary(specContext: string): string {
  const summary = summarizeSpecContext(specContext);
  if (summary.length === 0) {
    return "- No spec context provided.";
  }

  return summary.map((line) => `- ${line}`).join("\n");
}

function formatChangedFiles(paths: string[]): string {
  if (paths.length === 0) {
    return "- None";
  }

  return paths.map((filePath) => `- \`${filePath}\``).join("\n");
}

function selectDiffPreview(stagedDiff: string): string {
  const trimmed = stagedDiff.trim();
  if (trimmed.length === 0) {
    return "No staged diff content available.";
  }

  const lines = trimmed.split("\n").slice(0, 80);
  const preview = lines.join("\n");
  return preview.length <= 3000 ? preview : preview.slice(0, 3000);
}

function buildSuggestedBody(input: {
  specContext: string;
  stagedFilePaths: string[];
  stagedFileCount: number;
  insertions: number;
  deletions: number;
  stagedDiff: string;
}): string {
  const specSummary = formatSpecSummary(input.specContext);
  const filesList = formatChangedFiles(input.stagedFilePaths);
  const diffPreview = selectDiffPreview(input.stagedDiff);

  return [
    "## Summary",
    "- Generated from staged changes and current spec context.",
    "",
    "## Spec Context",
    specSummary,
    "",
    "## Staged Changes",
    `- Files: ${input.stagedFileCount}`,
    `- Line delta: +${input.insertions} / -${input.deletions}`,
    filesList,
    "",
    "## Diff Preview",
    "```diff",
    diffPreview,
    "```",
    "",
    "## Verification",
    "- [ ] pnpm run test -- pr-workflow",
    "- [ ] pnpm run desktop:typecheck"
  ].join("\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractGitHubApiMessage(payload: unknown): string | null {
  if (!isObject(payload)) {
    return null;
  }

  const message = payload.message;
  if (typeof message !== "string") {
    return null;
  }

  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const errorDetails = errors
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (isObject(entry) && typeof entry.message === "string") {
        return entry.message;
      }
      return "";
    })
    .filter((entry) => entry.length > 0);

  if (errorDetails.length === 0) {
    return message;
  }

  return `${message} (${errorDetails.join("; ")})`;
}

export class PullRequestWorkflowService {
  private readonly git: GitCli;
  private readonly pathExistsFn: (targetPath: string) => Promise<boolean>;
  private readonly fetchFn: GitHubFetch;
  private readonly apiBaseUrl: string;
  private readonly sessions = new Map<string, GitHubSessionRecord>();

  constructor(options: ServiceOptions = {}) {
    this.git = options.git ?? new GitCli(options.commandRunner);
    this.pathExistsFn = options.pathExists ?? pathExists;
    this.fetchFn = options.fetchFn ?? (fetch as GitHubFetch);
    this.apiBaseUrl = options.apiBaseUrl ?? GITHUB_API_BASE_URL;
  }

  async createGitHubSession(request: GitHubSessionRequest): Promise<GitHubSessionInfo> {
    const token = request.token.trim();
    if (token.length === 0) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.AUTH_REQUIRED,
        "Missing GitHub token.",
        "Paste a GitHub Personal Access Token and connect again."
      );
    }

    const response = await this.fetchFn(`${this.apiBaseUrl}/user`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    const payload = await this.readPayload(response);
    const detail = extractGitHubApiMessage(payload);

    if (response.status === 401) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.AUTH_REQUIRED,
        detail ?? "GitHub authentication failed.",
        "Use a valid token with repository access and retry."
      );
    }

    if (!response.ok) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_API_FAILED,
        detail ?? "GitHub authentication request failed.",
        "Check network access, token validity, and GitHub API availability."
      );
    }

    if (!isObject(payload) || typeof payload.login !== "string" || payload.login.trim().length === 0) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_API_FAILED,
        "GitHub API response is missing account details.",
        "Retry authentication. If this persists, create a new GitHub token."
      );
    }

    const createdAt = new Date().toISOString();
    const sessionId = `ghs-${randomUUID()}`;
    this.sessions.set(sessionId, {
      sessionId,
      token,
      login: payload.login,
      createdAt
    });

    return {
      sessionId,
      login: payload.login,
      createdAt
    };
  }

  async clearGitHubSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async generatePullRequestDraft(
    request: SpaceGitPullRequestDraftRequest
  ): Promise<SpaceGitPullRequestDraftResult> {
    await this.assertRepositoryAvailable(request.repoPath);

    if (!parseGitHubRepoReference(request.repoUrl)) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.INVALID_REPOSITORY_URL,
        `Unsupported GitHub repository URL: "${request.repoUrl}".`,
        "Use a GitHub repository URL like https://github.com/org/repo or git@github.com:org/repo.git."
      );
    }

    const rawStatus = await this.git.readStatusPorcelain(request.repoPath);
    const files = parseGitStatusPorcelain(rawStatus);
    const stagedFiles = files.filter(isStagedFileChange);

    if (stagedFiles.length === 0) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.NO_STAGED_CHANGES,
        "No staged changes found.",
        "Stage at least one file in Changes tab before generating a PR draft."
      );
    }

    const stagedNumstat = await this.git.readStagedNumstat(request.repoPath);
    const stagedSummary = summarizeStagedChanges(files, stagedNumstat);
    const stagedDiff = await this.git.readStagedDiff(request.repoPath);
    const headBranch = (await this.git.currentBranch(request.repoPath)).trim();

    if (!headBranch) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.REPOSITORY_BRANCH_MISSING,
        "Could not determine the current branch for this workspace.",
        "Switch to a named branch before creating a pull request."
      );
    }

    const baseBranch = request.baseBranch?.trim() || "main";
    const title = buildSuggestedTitle(request.specContext, stagedFiles.length);
    const body = buildSuggestedBody({
      specContext: request.specContext,
      stagedFilePaths: stagedFiles.map((file) => file.path),
      stagedFileCount: stagedFiles.length,
      insertions: stagedSummary.insertions,
      deletions: stagedSummary.deletions,
      stagedDiff
    });

    return {
      title,
      body,
      headBranch,
      baseBranch,
      stagedFileCount: stagedFiles.length,
      updatedAt: new Date().toISOString()
    };
  }

  async createPullRequest(
    request: SpaceGitCreatePullRequestRequest
  ): Promise<SpaceGitCreatePullRequestResult> {
    await this.assertRepositoryAvailable(request.repoPath);

    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.AUTH_SESSION_MISSING,
        "GitHub session expired or missing.",
        "Reconnect your GitHub session and retry pull request creation."
      );
    }

    const repoRef = parseGitHubRepoReference(request.repoUrl);
    if (!repoRef) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.INVALID_REPOSITORY_URL,
        `Unsupported GitHub repository URL: "${request.repoUrl}".`,
        "Update the space repository URL to a GitHub repository and retry."
      );
    }

    let originRepoRef: GitHubRepoRef | null = null;
    try {
      const originUrl = await this.git.readRemoteUrl(request.repoPath, "origin");
      originRepoRef = parseGitHubRepoReference(originUrl);
    } catch {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.REPOSITORY_MISMATCH,
        "Repository origin remote is missing or unreadable.",
        "Set the git origin remote to the same GitHub repository configured for this space."
      );
    }

    if (
      !originRepoRef ||
      originRepoRef.owner.toLowerCase() !== repoRef.owner.toLowerCase() ||
      originRepoRef.repo.toLowerCase() !== repoRef.repo.toLowerCase()
    ) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.REPOSITORY_MISMATCH,
        "Configured space repository does not match git origin remote.",
        "Align the space repo URL and local origin remote before creating a pull request."
      );
    }

    const headBranch = (await this.git.currentBranch(request.repoPath)).trim();
    if (!headBranch) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.REPOSITORY_BRANCH_MISSING,
        "Could not determine the current branch for this workspace.",
        "Switch to a named branch, commit/push changes, then retry."
      );
    }

    const baseBranch = request.baseBranch.trim() || "main";
    const title = request.title.trim();
    const body = request.body.trim();

    if (!title) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_VALIDATION_FAILED,
        "Pull request title is required.",
        "Enter a PR title before submitting."
      );
    }

    const response = await this.fetchFn(`${this.apiBaseUrl}/repos/${repoRef.owner}/${repoRef.repo}/pulls`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${session.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        body,
        head: headBranch,
        base: baseBranch
      })
    });

    const payload = await this.readPayload(response);
    const detail = extractGitHubApiMessage(payload);

    if (response.status === 401) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.AUTH_REQUIRED,
        detail ?? "GitHub token is unauthorized.",
        "Reconnect GitHub with a valid token and retry."
      );
    }

    if (response.status === 403) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_PERMISSION_DENIED,
        detail ?? "GitHub denied this pull request action.",
        "Ensure the token has pull request permissions and branch access for this repository."
      );
    }

    if (response.status === 404) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_REPOSITORY_NOT_FOUND,
        detail ?? "GitHub repository was not found or is not accessible.",
        "Verify repository owner/name and token access, then retry."
      );
    }

    if (response.status === 422) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_VALIDATION_FAILED,
        detail ?? "GitHub rejected this pull request payload.",
        "Confirm head/base branches exist remotely and that there are commits to compare."
      );
    }

    if (!response.ok) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_API_FAILED,
        detail ?? "GitHub pull request request failed.",
        "Retry after checking network/API status and repository permissions."
      );
    }

    if (
      !isObject(payload) ||
      typeof payload.html_url !== "string" ||
      typeof payload.number !== "number"
    ) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.GITHUB_API_FAILED,
        "GitHub response did not include a pull request URL.",
        "Retry pull request creation."
      );
    }

    return {
      url: payload.html_url,
      number: payload.number,
      title,
      headBranch,
      baseBranch,
      updatedAt: new Date().toISOString()
    };
  }

  private async readPayload(response: {
    json: () => Promise<unknown>;
    text: () => Promise<string>;
  }): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      try {
        const text = await response.text();
        return text ? { message: text } : null;
      } catch {
        return null;
      }
    }
  }

  private async assertRepositoryAvailable(repoPath: string): Promise<void> {
    const repoPathExists = await this.pathExistsFn(repoPath);
    if (!repoPathExists) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.REPOSITORY_MISSING,
        `Repository path "${repoPath}" was not found.`,
        "Select a valid repository path for this space."
      );
    }

    const isRepository = await this.git.isRepository(repoPath);
    if (!isRepository) {
      throw new PullRequestWorkflowError(
        PR_WORKFLOW_ERROR_CODES.REPOSITORY_MISSING,
        `Path "${repoPath}" is not a git repository.`,
        "Run git init or choose a valid repository path for this space."
      );
    }
  }
}
