import {
  isSpaceGitLifecycleStatus,
  type SpaceGitLifecycleStatus
} from "../git/types";

export const APP_STATE_VERSION = 1;

export type NavigationView = "explorer" | "orchestrator" | "spec" | "changes";

export interface SpaceRecord {
  id: string;
  name: string;
  rootPath: string;
  description: string;
  tags: string[];
  repoUrl?: string;
  gitStatus?: SpaceGitLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  spaceId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  version: number;
  activeView: NavigationView;
  activeSpaceId: string;
  activeSessionId: string;
  spaces: SpaceRecord[];
  sessions: SessionRecord[];
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
  return value === "explorer" || value === "orchestrator" || value === "spec" || value === "changes";
}

function isSpaceRecord(value: unknown): value is SpaceRecord {
  if (!isObject(value)) {
    return false;
  }

  const maybeRepoUrl = value.repoUrl;
  const repoUrlIsValid = maybeRepoUrl === undefined || isString(maybeRepoUrl);
  const gitStatusIsValid =
    value.gitStatus === undefined || isSpaceGitLifecycleStatus(value.gitStatus);

  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.rootPath) &&
    typeof value.description === "string" &&
    isStringArray(value.tags) &&
    repoUrlIsValid &&
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
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
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
    lastOpenedAt: isString(input.lastOpenedAt) ? input.lastOpenedAt : fallback.lastOpenedAt
  };
}
