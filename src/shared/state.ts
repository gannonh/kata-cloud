import {
  isSpaceGitLifecycleStatus,
  type SpaceGitLifecycleStatus
} from "../git/types";
import type {
  ContextProviderId,
  ContextRetrievalError,
  ContextRetrievalErrorCode,
  ContextSnippet
} from "../context/types";
import { ALLOWED_RUN_TRANSITIONS } from "./orchestrator-run-lifecycle";

export const APP_STATE_VERSION = 1;

export type NavigationView = "explorer" | "orchestrator" | "spec" | "changes" | "browser";
export type OrchestratorRunStatus = "queued" | "running" | "completed" | "failed";
export type OrchestratorTaskType = "implement" | "verify" | "debug";
export type OrchestratorTaskStatus =
  | "queued"
  | "delegating"
  | "delegated"
  | "running"
  | "completed"
  | "failed";

export interface OrchestratorSpecDraft {
  runId: string;
  generatedAt: string;
  content: string;
}

export interface OrchestratorDelegatedTaskRecord {
  id: string;
  runId: string;
  type: OrchestratorTaskType;
  specialist: string;
  status: OrchestratorTaskStatus;
  statusTimeline: OrchestratorTaskStatus[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface SpaceRecord {
  id: string;
  name: string;
  rootPath: string;
  description: string;
  tags: string[];
  repoUrl?: string;
  contextProvider?: ContextProviderId;
  gitStatus?: SpaceGitLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  spaceId: string;
  label: string;
  contextProvider?: ContextProviderId;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestratorRunRecord {
  id: string;
  spaceId: string;
  sessionId: string;
  prompt: string;
  status: OrchestratorRunStatus;
  statusTimeline: OrchestratorRunStatus[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  contextRetrievalError?: ContextRetrievalError;
  contextSnippets?: ContextSnippet[];
  draft?: OrchestratorSpecDraft;
  draftAppliedAt?: string;
  draftApplyError?: string;
  delegatedTasks?: OrchestratorDelegatedTaskRecord[];
}

export interface AppState {
  version: number;
  activeView: NavigationView;
  activeSpaceId: string;
  activeSessionId: string;
  spaces: SpaceRecord[];
  sessions: SessionRecord[];
  orchestratorRuns: OrchestratorRunRecord[];
  lastOpenedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNavigationView(value: unknown): value is NavigationView {
  return (
    value === "explorer" ||
    value === "orchestrator" ||
    value === "spec" ||
    value === "changes" ||
    value === "browser"
  );
}

function isOrchestratorRunStatus(value: unknown): value is OrchestratorRunStatus {
  return value === "queued" || value === "running" || value === "completed" || value === "failed";
}

function isContextProviderId(value: unknown): value is ContextProviderId {
  return value === "filesystem" || value === "mcp";
}

const CONTEXT_RETRIEVAL_ERROR_CODES: ReadonlySet<ContextRetrievalErrorCode> = new Set([
  "provider_unavailable",
  "unsupported_provider",
  "invalid_query",
  "invalid_root_path",
  "io_failure"
]);

function isContextRetrievalErrorCode(value: unknown): value is ContextRetrievalErrorCode {
  return typeof value === "string" && CONTEXT_RETRIEVAL_ERROR_CODES.has(value as ContextRetrievalErrorCode);
}

function isContextSnippet(value: unknown): value is ContextSnippet {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isContextProviderId(value.provider) &&
    isString(value.path) &&
    isString(value.source) &&
    typeof value.content === "string" &&
    typeof value.score === "number" &&
    Number.isFinite(value.score)
  );
}

function isContextRetrievalError(value: unknown): value is ContextRetrievalError {
  if (!isObject(value)) {
    return false;
  }

  return (
    isContextRetrievalErrorCode(value.code) &&
    isString(value.message) &&
    isString(value.remediation) &&
    typeof value.retryable === "boolean" &&
    isContextProviderId(value.providerId)
  );
}

function isOrchestratorTaskType(value: unknown): value is OrchestratorTaskType {
  return value === "implement" || value === "verify" || value === "debug";
}

function isOrchestratorTaskStatus(value: unknown): value is OrchestratorTaskStatus {
  return (
    value === "queued" ||
    value === "delegating" ||
    value === "delegated" ||
    value === "running" ||
    value === "completed" ||
    value === "failed"
  );
}

function isOrchestratorSpecDraft(value: unknown): value is OrchestratorSpecDraft {
  if (!isObject(value)) {
    return false;
  }

  return isString(value.runId) && isString(value.generatedAt) && typeof value.content === "string";
}

function isOrchestratorDelegatedTaskRecord(value: unknown): value is OrchestratorDelegatedTaskRecord {
  if (!isObject(value)) {
    return false;
  }

  const completedAtIsValid = value.completedAt === undefined || isString(value.completedAt);
  const errorMessageIsValid = value.errorMessage === undefined || isString(value.errorMessage);

  return (
    isString(value.id) &&
    isString(value.runId) &&
    isOrchestratorTaskType(value.type) &&
    isString(value.specialist) &&
    isOrchestratorTaskStatus(value.status) &&
    Array.isArray(value.statusTimeline) &&
    value.statusTimeline.length > 0 &&
    value.statusTimeline.every(isOrchestratorTaskStatus) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    completedAtIsValid &&
    errorMessageIsValid
  );
}

function isSpaceRecord(value: unknown): value is SpaceRecord {
  if (!isObject(value)) {
    return false;
  }

  const maybeRepoUrl = value.repoUrl;
  const repoUrlIsValid = maybeRepoUrl === undefined || isString(maybeRepoUrl);
  const contextProviderIsValid =
    value.contextProvider === undefined || isContextProviderId(value.contextProvider);
  const gitStatusIsValid =
    value.gitStatus === undefined || isSpaceGitLifecycleStatus(value.gitStatus);

  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.rootPath) &&
    typeof value.description === "string" &&
    isStringArray(value.tags) &&
    repoUrlIsValid &&
    contextProviderIsValid &&
    gitStatusIsValid &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.spaceId) &&
    isString(value.label) &&
    (value.contextProvider === undefined || isContextProviderId(value.contextProvider)) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function hasValidRunTimeline(
  statusTimeline: OrchestratorRunStatus[],
  status: OrchestratorRunStatus
): boolean {
  if (statusTimeline.length === 0 || statusTimeline[0] !== "queued") {
    return false;
  }

  const dedupedTimeline: OrchestratorRunStatus[] = [];
  for (const entry of statusTimeline) {
    if (dedupedTimeline[dedupedTimeline.length - 1] !== entry) {
      dedupedTimeline.push(entry);
    }
  }

  if (dedupedTimeline.length === 0 || dedupedTimeline[dedupedTimeline.length - 1] !== status) {
    return false;
  }

  for (let index = 1; index < dedupedTimeline.length; index += 1) {
    const from = dedupedTimeline[index - 1];
    const to = dedupedTimeline[index];
    if (!ALLOWED_RUN_TRANSITIONS[from].includes(to)) {
      return false;
    }
  }

  return true;
}

function normalizeOrchestratorRunRecord(value: unknown): OrchestratorRunRecord | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.spaceId) ||
    !isString(value.sessionId) ||
    typeof value.prompt !== "string" ||
    !isString(value.createdAt) ||
    !isString(value.updatedAt)
  ) {
    return null;
  }

  if (!isOrchestratorRunStatus(value.status)) {
    return null;
  }
  const runStatus = value.status;

  if (
    !Array.isArray(value.statusTimeline) ||
    value.statusTimeline.length === 0 ||
    !value.statusTimeline.every(isOrchestratorRunStatus) ||
    !hasValidRunTimeline(value.statusTimeline, runStatus)
  ) {
    return null;
  }

  const terminalStatus = runStatus === "completed" || runStatus === "failed";
  const completedAt = isString(value.completedAt) ? value.completedAt : undefined;
  if (terminalStatus && !completedAt) {
    return null;
  }

  const contextSnippets = Array.isArray(value.contextSnippets)
    ? value.contextSnippets.filter(isContextSnippet)
    : undefined;
  const draft = isOrchestratorSpecDraft(value.draft) ? value.draft : undefined;
  const draftAppliedAt = isString(value.draftAppliedAt) ? value.draftAppliedAt : undefined;
  const draftApplyError = isString(value.draftApplyError) ? value.draftApplyError : undefined;
  const delegatedTasks = Array.isArray(value.delegatedTasks)
    ? value.delegatedTasks.filter(isOrchestratorDelegatedTaskRecord)
    : undefined;

  return {
    id: value.id,
    spaceId: value.spaceId,
    sessionId: value.sessionId,
    prompt: value.prompt,
    status: runStatus,
    statusTimeline: value.statusTimeline,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt,
    errorMessage: isString(value.errorMessage) ? value.errorMessage : undefined,
    contextRetrievalError: isContextRetrievalError(value.contextRetrievalError)
      ? value.contextRetrievalError
      : undefined,
    contextSnippets,
    draft,
    draftAppliedAt,
    draftApplyError,
    delegatedTasks
  };
}

export function createInitialAppState(nowIso = new Date().toISOString()): AppState {
  const starterSpaceId = "space-getting-started";
  const starterSessionId = "session-getting-started";

  return {
    version: APP_STATE_VERSION,
    activeView: "orchestrator",
    activeSpaceId: starterSpaceId,
    activeSessionId: starterSessionId,
    spaces: [
      {
        id: starterSpaceId,
        name: "Getting Started Space",
        rootPath: "~/kata/getting-started",
        description: "Starter space for bootstrapping the app shell and workflow.",
        tags: ["starter", "bootstrap"],
        contextProvider: "filesystem",
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    sessions: [
      {
        id: starterSessionId,
        spaceId: starterSpaceId,
        label: "Initial Orchestrator Session",
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    orchestratorRuns: [],
    lastOpenedAt: nowIso
  };
}

export function normalizeAppState(input: unknown): AppState {
  const fallback = createInitialAppState();

  if (!isObject(input)) {
    return fallback;
  }

  const spaces = Array.isArray(input.spaces) ? input.spaces.filter(isSpaceRecord) : [];
  const usableSpaces = spaces.length > 0 ? spaces : fallback.spaces;
  const allowedSpaceIds = new Set(usableSpaces.map((space) => space.id));

  const sessions = Array.isArray(input.sessions) ? input.sessions.filter(isSessionRecord) : [];
  const linkedSessions = sessions.filter((session) => allowedSpaceIds.has(session.spaceId));
  const usableSessions = linkedSessions.length > 0 ? linkedSessions : fallback.sessions;
  const allowedSessionIds = new Set(usableSessions.map((session) => session.id));
  const orchestratorRuns = Array.isArray(input.orchestratorRuns)
    ? input.orchestratorRuns
        .map((entry) => {
          const normalizedEntry = normalizeOrchestratorRunRecord(entry);
          if (normalizedEntry) {
            return normalizedEntry;
          }
          const id =
            isObject(entry) && isString((entry as Record<string, unknown>).id)
              ? (entry as Record<string, unknown>).id
              : "(unknown)";
          console.warn(`normalizeAppState: dropping invalid orchestrator run record (id=${id})`);
          return null;
        })
        .filter((entry): entry is OrchestratorRunRecord => entry !== null)
    : [];
  const linkedOrchestratorRuns = orchestratorRuns.filter(
    (run) => allowedSpaceIds.has(run.spaceId) && allowedSessionIds.has(run.sessionId)
  );

  const activeSpaceId = isString(input.activeSpaceId) && allowedSpaceIds.has(input.activeSpaceId)
    ? input.activeSpaceId
    : usableSpaces[0].id;

  const activeSessionId = isString(input.activeSessionId) && allowedSessionIds.has(input.activeSessionId)
    ? input.activeSessionId
    : usableSessions.find((session) => session.spaceId === activeSpaceId)?.id ?? usableSessions[0].id;

  return {
    version: APP_STATE_VERSION,
    activeView: isNavigationView(input.activeView) ? input.activeView : fallback.activeView,
    activeSpaceId,
    activeSessionId,
    spaces: usableSpaces,
    sessions: usableSessions,
    orchestratorRuns: linkedOrchestratorRuns,
    lastOpenedAt: isString(input.lastOpenedAt) ? input.lastOpenedAt : fallback.lastOpenedAt
  };
}
