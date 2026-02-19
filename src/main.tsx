import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createSpaceGitRequest,
  createSpaceGitStatus,
  type GitHubSessionInfo,
  type SpaceGitChangeFile,
  type SpaceGitChangesSnapshot,
  type SpaceGitCreatePullRequestResult,
  type SpaceGitFileDiffResult,
  type SpaceGitLifecycleRequest,
  type SpaceGitLifecycleStatus,
  type SpaceGitPullRequestDraftResult
} from "./git/types";
import {
  isStagedFileChange,
  isUnstagedFileChange,
  toGitStatusLabel
} from "./git/changes";
import { DiffText } from "./git/changes-diff-text";
import { toSpaceGitUiState } from "./git/space-git-ui-state";
import { SpecNotePanel } from "./notes/spec-note-panel";
import { loadSpecNote } from "./notes/store";
import { buildDelegatedTaskTimeline } from "./shared/orchestrator-delegation";
import { transitionOrchestratorRunStatus } from "./shared/orchestrator-run-lifecycle";
import {
  getRunHistoryForActiveSession,
  getRunsForActiveSession
} from "./shared/orchestrator-run-history";
import {
  projectOrchestratorRunHistory,
  projectOrchestratorRunViewModel
} from "./shared/orchestrator-run-view-model";
import {
  createInitialBrowserNavigationState,
  DEFAULT_LOCAL_PREVIEW_URL,
  navigateBrowserHistory,
  normalizeLocalPreviewUrl,
  stepBrowserHistory
} from "./browser/local-dev-browser";
import {
  AppState,
  NavigationView,
  OrchestratorRunRecord,
  OrchestratorSpecDraft,
  OrchestratorRunStatus,
  SessionRecord,
  SpaceRecord,
  createInitialAppState,
  normalizeAppState
} from "./shared/state";
import type { CreateSpaceInput, SpaceMetadata } from "./space/types";
import {
  parseTags,
  suggestSpaceNameFromPrompt,
  type SpaceValidationErrors,
  validateCreateSpaceInput
} from "./space/validation";
import {
  resolveContextProviderId
} from "./context/context-adapter";
import type { ContextSnippet } from "./context/types";
import "./styles.css";
import { resolveRunFailure } from "./shared/orchestrator-failure";

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("Missing #app root element.");
}

const LOCAL_FALLBACK_KEY = "kata-cloud.local-state.v1";

const viewOrder: NavigationView[] = ["explorer", "orchestrator", "spec", "changes", "browser"];

function readLocalFallbackState(): AppState {
  try {
    const raw = window.localStorage.getItem(LOCAL_FALLBACK_KEY);
    if (!raw) {
      return createInitialAppState();
    }

    return normalizeAppState(JSON.parse(raw));
  } catch {
    return createInitialAppState();
  }
}

function writeLocalFallbackState(nextState: AppState): void {
  try {
    window.localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(nextState));
  } catch {
    // Keep runtime resilient when storage quota is unavailable.
  }
}

function toViewLabel(view: NavigationView): string {
  switch (view) {
    case "explorer":
      return "Explorer";
    case "orchestrator":
      return "Orchestrator";
    case "spec":
      return "Spec";
    case "changes":
      return "Changes";
    case "browser":
      return "Browser";
    default:
      return view;
  }
}

function createSessionLabel(existingCount: number): string {
  return `Session ${existingCount + 1}`;
}

function createOrchestratorRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `run-${crypto.randomUUID()}`;
  }

  return `run-${Date.now()}`;
}

function formatContextSnippetSection(snippets: ContextSnippet[]): string {
  if (snippets.length === 0) {
    return "## Context Snippets\n- No matching snippets found.";
  }

  return [
    "## Context Snippets",
    ...snippets.map((snippet) => `- ${snippet.path}: ${snippet.content}`)
  ].join("\n");
}

function createSpecDraft(
  run: OrchestratorRunRecord,
  generatedAt: string,
  contextSnippets: ContextSnippet[]
): OrchestratorSpecDraft {
  const prompt = run.prompt.trim();
  const summary = prompt.length > 0 ? prompt : "Describe the project outcome.";
  const defaultTask = suggestSpaceNameFromPrompt(prompt).replace(/-/g, " ").trim() || "define implementation milestones";

  return {
    runId: run.id,
    generatedAt,
    content: `## Goal\n${summary}\n\n## Tasks\n- [ ] ${defaultTask}\n\n${formatContextSnippetSection(contextSnippets)}\n\n## Acceptance Criteria\n1. Define measurable completion criteria.\n\n## Verification Plan\n1. Run targeted tests.\n2. Run desktop typecheck.`
  };
}

type CreateSpaceDraft = {
  name: string;
  path: string;
  repo: string;
  description: string;
  tags: string;
};

const EMPTY_CREATE_SPACE_DRAFT: CreateSpaceDraft = {
  name: "",
  path: "",
  repo: "",
  description: "",
  tags: ""
};

function createSpaceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `space-${crypto.randomUUID()}`;
  }

  return `space-${Date.now()}`;
}

function toSpaceMetadata(space: SpaceRecord): SpaceMetadata {
  return {
    id: space.id,
    prompt: "",
    name: space.name,
    path: space.rootPath,
    repo: space.repoUrl,
    description: space.description,
    tags: space.tags,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt
  };
}

function resolveSpaceChangesRepoPath(space: SpaceRecord): string | null {
  if (space.gitStatus?.worktreePath) {
    return space.gitStatus.worktreePath;
  }

  const rootPath = space.rootPath.trim();
  if (rootPath.length > 0) {
    return rootPath;
  }

  return null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error.";
}

function toChangePathLabel(change: SpaceGitChangeFile): string {
  if (!change.previousPath) {
    return change.path;
  }

  return `${change.previousPath} -> ${change.path}`;
}

function App(): React.JSX.Element {
  const [state, setState] = useState<AppState>(() => createInitialAppState());
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [spacePrompt, setSpacePrompt] = useState("");
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);
  const [spaceDraft, setSpaceDraft] = useState<CreateSpaceDraft>(EMPTY_CREATE_SPACE_DRAFT);
  const [spaceErrors, setSpaceErrors] = useState<SpaceValidationErrors>({});
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editSpaceDraft, setEditSpaceDraft] = useState<CreateSpaceDraft>(EMPTY_CREATE_SPACE_DRAFT);
  const [editSpaceErrors, setEditSpaceErrors] = useState<SpaceValidationErrors>({});
  const [activeGitOperationSpaceId, setActiveGitOperationSpaceId] = useState<string | null>(null);
  const [changesSnapshot, setChangesSnapshot] = useState<SpaceGitChangesSnapshot | null>(null);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);
  const [selectedChangePath, setSelectedChangePath] = useState<string | null>(null);
  const [selectedFileDiff, setSelectedFileDiff] = useState<SpaceGitFileDiffResult | null>(null);
  const [isLoadingFileDiff, setIsLoadingFileDiff] = useState(false);
  const [activeFileActionKey, setActiveFileActionKey] = useState<string | null>(null);
  const [githubTokenInput, setGitHubTokenInput] = useState("");
  const [githubSession, setGitHubSession] = useState<GitHubSessionInfo | null>(null);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isGeneratingPullRequestDraft, setIsGeneratingPullRequestDraft] = useState(false);
  const [isCreatingPullRequest, setIsCreatingPullRequest] = useState(false);
  const [pullRequestBaseBranch, setPullRequestBaseBranch] = useState("main");
  const [pullRequestTitle, setPullRequestTitle] = useState("");
  const [pullRequestBody, setPullRequestBody] = useState("");
  const [pullRequestDraft, setPullRequestDraft] = useState<SpaceGitPullRequestDraftResult | null>(null);
  const [createdPullRequest, setCreatedPullRequest] = useState<SpaceGitCreatePullRequestResult | null>(null);
  const [pullRequestStatusMessage, setPullRequestStatusMessage] = useState<string | null>(null);
  const changesSnapshotRequestIdRef = useRef(0);
  const [browserNavigation, setBrowserNavigation] = useState(() => createInitialBrowserNavigationState());
  const [browserInput, setBrowserInput] = useState(DEFAULT_LOCAL_PREVIEW_URL);
  const [browserRefreshKey, setBrowserRefreshKey] = useState(0);
  const [browserError, setBrowserError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function hydrate(): Promise<void> {
      const shellApi = window.kataShell;

      if (!shellApi) {
        if (!cancelled) {
          setState(readLocalFallbackState());
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const initial = normalizeAppState(await shellApi.getState());
        if (!cancelled) {
          setState(initial);
          setIsBootstrapping(false);
        }

        unsubscribe = shellApi.subscribeState((nextState) => {
          if (!cancelled) {
            setState(normalizeAppState(nextState));
          }
        });
      } catch {
        if (!cancelled) {
          setState(readLocalFallbackState());
          setIsBootstrapping(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const persistState = useCallback(async (nextState: AppState) => {
    const normalized = normalizeAppState(nextState);
    setState(normalized);
    setIsSaving(true);

    try {
      if (window.kataShell) {
        const persisted = await window.kataShell.saveState(normalized);
        setState(normalizeAppState(persisted));
      } else {
        writeLocalFallbackState(normalized);
      }
    } catch {
      writeLocalFallbackState(normalized);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const persistGitStatus = useCallback(
    async (spaceId: string, status: SpaceGitLifecycleStatus) => {
      const now = new Date().toISOString();
      const nextState: AppState = {
        ...state,
        spaces: state.spaces.map((space) =>
          space.id === spaceId
            ? {
                ...space,
                gitStatus: status,
                updatedAt: now
              }
            : space
        ),
        lastOpenedAt: now
      };

      await persistState(nextState);
    },
    [persistState, state]
  );

  const resolveSpaceGitRequest = useCallback((space: SpaceRecord): SpaceGitLifecycleRequest => {
    if (space.gitStatus) {
      return {
        spaceId: space.id,
        repoPath: space.gitStatus.repoPath,
        branchName: space.gitStatus.branchName,
        worktreePath: space.gitStatus.worktreePath
      };
    }

    return createSpaceGitRequest({
      spaceId: space.id,
      spaceName: space.name,
      repoPath: space.rootPath
    });
  }, []);

  const runSpaceGitLifecycle = useCallback(
    async (space: SpaceRecord, mode: "initialize" | "switch") => {
      const request = resolveSpaceGitRequest(space);
      const inProgressStatus = createSpaceGitStatus(
        request,
        mode === "initialize" ? "initializing" : "switching",
        mode === "initialize"
          ? "Setting up branch and worktree."
          : "Switching branch and worktree."
      );

      setActiveGitOperationSpaceId(space.id);
      await persistGitStatus(space.id, inProgressStatus);

      try {
        const shellApi = window.kataShell;
        if (!shellApi) {
          await persistGitStatus(
            space.id,
            createSpaceGitStatus(
              request,
              "error",
              "Git lifecycle service is unavailable in this runtime.",
              "Run this action from the desktop shell runtime, then retry."
            )
          );
          return;
        }

        const nextStatus =
          mode === "initialize"
            ? await shellApi.initializeSpaceGit(request)
            : await shellApi.switchSpaceGit(request);

        await persistGitStatus(space.id, nextStatus);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";
        await persistGitStatus(
          space.id,
          createSpaceGitStatus(
            request,
            "error",
            `Git lifecycle failed: ${message}`,
            "Verify repository path and working tree state, then retry."
          )
        );
      } finally {
        setActiveGitOperationSpaceId((currentSpaceId) =>
          currentSpaceId === space.id ? null : currentSpaceId
        );
      }
    },
    [persistGitStatus, resolveSpaceGitRequest]
  );

  const activeSpace = useMemo(
    () => state.spaces.find((space) => space.id === state.activeSpaceId),
    [state.activeSpaceId, state.spaces]
  );
  const activeSpaceGitUiState = useMemo(
    () => (activeSpace ? toSpaceGitUiState(activeSpace.gitStatus) : null),
    [activeSpace]
  );
  const activeChangesRepoPath = useMemo(
    () => (activeSpace ? resolveSpaceChangesRepoPath(activeSpace) : null),
    [activeSpace]
  );
  const selectedChange = useMemo(
    () =>
      changesSnapshot?.files.find((change) => change.path === selectedChangePath) ?? null,
    [changesSnapshot, selectedChangePath]
  );

  const activeSession = useMemo(
    () => state.sessions.find((session) => session.id === state.activeSessionId),
    [state.activeSessionId, state.sessions]
  );
  const runsForActiveSession = useMemo(
    () => getRunsForActiveSession(state.orchestratorRuns, state.activeSpaceId, state.activeSessionId),
    [state.activeSessionId, state.activeSpaceId, state.orchestratorRuns]
  );
  const runHistoryForActiveSession = useMemo(
    () => getRunHistoryForActiveSession(runsForActiveSession),
    [runsForActiveSession]
  );
  const latestRunForActiveSession = useMemo(
    () => runHistoryForActiveSession[0],
    [runHistoryForActiveSession]
  );
  const latestRunViewModel = useMemo(
    () => (latestRunForActiveSession ? projectOrchestratorRunViewModel(latestRunForActiveSession) : null),
    [latestRunForActiveSession]
  );
  const priorRunHistoryForActiveSession = useMemo(
    () => runHistoryForActiveSession.filter((run) => run.id !== latestRunForActiveSession?.id),
    [latestRunForActiveSession?.id, runHistoryForActiveSession]
  );
  const priorRunHistoryViewModels = useMemo(
    () => projectOrchestratorRunHistory(priorRunHistoryForActiveSession),
    [priorRunHistoryForActiveSession]
  );
  const latestDraftForActiveSession = latestRunForActiveSession?.draft;

  const sessionsForActiveSpace = useMemo(
    () => state.sessions.filter((session) => session.spaceId === state.activeSpaceId),
    [state.activeSpaceId, state.sessions]
  );
  const currentBrowserUrl = useMemo(
    () => browserNavigation.entries[browserNavigation.index] ?? DEFAULT_LOCAL_PREVIEW_URL,
    [browserNavigation]
  );
  const canGoBack = browserNavigation.index > 0;
  const canGoForward = browserNavigation.index < browserNavigation.entries.length - 1;

  useEffect(() => {
    setPullRequestDraft(null);
    setCreatedPullRequest(null);
    setPullRequestStatusMessage(null);
    setPullRequestTitle("");
    setPullRequestBody("");
    setPullRequestBaseBranch("main");
  }, [activeSpace?.id]);

  const applyChangesSnapshot = useCallback((snapshot: SpaceGitChangesSnapshot) => {
    setChangesSnapshot(snapshot);
    setSelectedChangePath((currentPath) => {
      if (snapshot.files.length === 0) {
        return null;
      }

      if (currentPath && snapshot.files.some((file) => file.path === currentPath)) {
        return currentPath;
      }

      return snapshot.files[0]?.path ?? null;
    });
  }, []);

  const loadChangesSnapshot = useCallback(async () => {
    const requestId = changesSnapshotRequestIdRef.current + 1;
    changesSnapshotRequestIdRef.current = requestId;

    if (!activeChangesRepoPath) {
      setChangesSnapshot(null);
      setSelectedChangePath(null);
      setSelectedFileDiff(null);
      setChangesError(null);
      setIsLoadingChanges(false);
      return;
    }

    const shellApi = window.kataShell;
    if (!shellApi) {
      setChangesError("Git changes are unavailable in this runtime.");
      setChangesSnapshot(null);
      setSelectedChangePath(null);
      setSelectedFileDiff(null);
      setIsLoadingChanges(false);
      return;
    }

    setIsLoadingChanges(true);
    setChangesError(null);

    try {
      const snapshot = await shellApi.getSpaceChanges({ repoPath: activeChangesRepoPath });
      if (requestId !== changesSnapshotRequestIdRef.current) {
        return;
      }
      applyChangesSnapshot(snapshot);
    } catch (error) {
      if (requestId !== changesSnapshotRequestIdRef.current) {
        return;
      }
      setChangesError(`Unable to load changes: ${toErrorMessage(error)}`);
    } finally {
      if (requestId === changesSnapshotRequestIdRef.current) {
        setIsLoadingChanges(false);
      }
    }
  }, [activeChangesRepoPath, applyChangesSnapshot]);

  useEffect(() => {
    if (state.activeView !== "changes") {
      return;
    }

    void loadChangesSnapshot();

    return () => {
      changesSnapshotRequestIdRef.current += 1;
    };
  }, [loadChangesSnapshot, state.activeView, activeSpace?.gitStatus?.updatedAt]);

  useEffect(() => {
    if (state.activeView !== "changes" || !activeChangesRepoPath || !selectedChange) {
      setSelectedFileDiff(null);
      return;
    }

    const shellApi = window.kataShell;
    if (!shellApi) {
      setSelectedFileDiff(null);
      return;
    }

    const includeStaged = isStagedFileChange(selectedChange);
    const includeUnstaged = isUnstagedFileChange(selectedChange);

    if (!includeStaged && !includeUnstaged) {
      setSelectedFileDiff(null);
      return;
    }

    let cancelled = false;
    setIsLoadingFileDiff(true);

    void shellApi
      .getSpaceFileDiff({
        repoPath: activeChangesRepoPath,
        filePath: selectedChange.path,
        includeStaged,
        includeUnstaged
      })
      .then((nextDiff) => {
        if (!cancelled) {
          setSelectedFileDiff(nextDiff);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setChangesError(`Unable to load file diff: ${toErrorMessage(error)}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingFileDiff(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChangesRepoPath, selectedChange, state.activeView]);

  const onRunFileStageAction = useCallback(
    async (filePath: string, action: "stage" | "unstage") => {
      if (!activeChangesRepoPath || !window.kataShell) {
        return;
      }

      setActiveFileActionKey(`${action}:${filePath}`);
      setChangesError(null);

      try {
        const shellApi = window.kataShell;
        const snapshot =
          action === "stage"
            ? await shellApi.stageSpaceFile({
                repoPath: activeChangesRepoPath,
                filePath
              })
            : await shellApi.unstageSpaceFile({
                repoPath: activeChangesRepoPath,
                filePath
              });
        applyChangesSnapshot(snapshot);
      } catch (error) {
        setChangesError(`Unable to ${action} file: ${toErrorMessage(error)}`);
      } finally {
        setActiveFileActionKey((currentAction) =>
          currentAction === `${action}:${filePath}` ? null : currentAction
        );
      }
    },
    [activeChangesRepoPath, applyChangesSnapshot]
  );

  const onConnectGitHub = useCallback(async () => {
    if (!window.kataShell) {
      setPullRequestStatusMessage(
        "GitHub auth is unavailable in this runtime. Open the desktop shell and retry."
      );
      return;
    }

    setIsConnectingGitHub(true);
    setPullRequestStatusMessage(null);

    try {
      const session = await window.kataShell.createGitHubSession({
        token: githubTokenInput
      });
      setGitHubSession(session);
      setGitHubTokenInput("");
      setPullRequestStatusMessage(`Connected to GitHub as ${session.login}.`);
    } catch (error) {
      setPullRequestStatusMessage(`GitHub connection failed: ${toErrorMessage(error)}`);
    } finally {
      setIsConnectingGitHub(false);
    }
  }, [githubTokenInput]);

  const onDisconnectGitHub = useCallback(async () => {
    try {
      if (window.kataShell && githubSession) {
        await window.kataShell.clearGitHubSession(githubSession.sessionId);
      }
    } finally {
      setGitHubSession(null);
      setPullRequestStatusMessage("Disconnected GitHub session.");
    }
  }, [githubSession]);

  const onGeneratePullRequestDraft = useCallback(async () => {
    if (!window.kataShell) {
      setPullRequestStatusMessage(
        "Pull request workflow is unavailable in this runtime. Open the desktop shell and retry."
      );
      return;
    }

    if (!activeChangesRepoPath || !activeSpace?.repoUrl) {
      setPullRequestStatusMessage(
        "A linked GitHub repository is required before generating a pull request draft."
      );
      return;
    }

    if (!changesSnapshot?.hasStagedChanges) {
      setPullRequestStatusMessage("Stage at least one file before generating a pull request draft.");
      return;
    }

    setIsGeneratingPullRequestDraft(true);
    setPullRequestStatusMessage(null);
    setCreatedPullRequest(null);

    try {
      const specContext = loadSpecNote(window.localStorage).content;
      const draft = await window.kataShell.generatePullRequestDraft({
        repoPath: activeChangesRepoPath,
        repoUrl: activeSpace.repoUrl,
        specContext,
        baseBranch: pullRequestBaseBranch
      });
      setPullRequestDraft(draft);
      setPullRequestTitle(draft.title);
      setPullRequestBody(draft.body);
      setPullRequestBaseBranch(draft.baseBranch);
      setPullRequestStatusMessage(
        `Generated PR suggestion from ${draft.stagedFileCount} staged file(s).`
      );
    } catch (error) {
      setPullRequestStatusMessage(`Unable to generate PR suggestion: ${toErrorMessage(error)}`);
    } finally {
      setIsGeneratingPullRequestDraft(false);
    }
  }, [activeChangesRepoPath, activeSpace?.repoUrl, changesSnapshot?.hasStagedChanges, pullRequestBaseBranch]);

  const onCreatePullRequest = useCallback(async () => {
    if (!window.kataShell) {
      setPullRequestStatusMessage(
        "Pull request workflow is unavailable in this runtime. Open the desktop shell and retry."
      );
      return;
    }

    if (!activeChangesRepoPath || !activeSpace?.repoUrl) {
      setPullRequestStatusMessage(
        "A linked GitHub repository is required before creating a pull request."
      );
      return;
    }

    if (!githubSession) {
      setPullRequestStatusMessage("Connect GitHub before creating a pull request.");
      return;
    }

    setIsCreatingPullRequest(true);
    setPullRequestStatusMessage(null);

    try {
      const result = await window.kataShell.createPullRequest({
        repoPath: activeChangesRepoPath,
        repoUrl: activeSpace.repoUrl,
        sessionId: githubSession.sessionId,
        title: pullRequestTitle,
        body: pullRequestBody,
        baseBranch: pullRequestBaseBranch
      });
      setCreatedPullRequest(result);
      setPullRequestStatusMessage(
        `Created PR #${result.number}: ${result.url}`
      );
    } catch (error) {
      setPullRequestStatusMessage(`Unable to create pull request: ${toErrorMessage(error)}`);
    } finally {
      setIsCreatingPullRequest(false);
    }
  }, [
    activeChangesRepoPath,
    activeSpace?.repoUrl,
    githubSession,
    pullRequestBaseBranch,
    pullRequestBody,
    pullRequestTitle
  ]);

  const onOpenCreatedPullRequest = useCallback(async () => {
    if (!createdPullRequest) {
      return;
    }

    if (window.kataShell) {
      await window.kataShell.openExternalUrl(createdPullRequest.url);
      return;
    }

    window.open(createdPullRequest.url, "_blank", "noopener,noreferrer");
  }, [createdPullRequest]);

  const onViewSelect = useCallback(
    (view: NavigationView) => {
      if (view === state.activeView) {
        return;
      }

      void persistState({
        ...state,
        activeView: view,
        lastOpenedAt: new Date().toISOString()
      });
    },
    [persistState, state]
  );

  const onSpaceSelect = useCallback(
    (space: SpaceRecord) => {
      if (space.id === state.activeSpaceId) {
        return;
      }

      const firstSession = state.sessions.find((session) => session.spaceId === space.id);
      setEditingSpaceId(null);
      setEditSpaceErrors({});
      void persistState({
        ...state,
        activeSpaceId: space.id,
        activeSessionId: firstSession ? firstSession.id : state.activeSessionId,
        lastOpenedAt: new Date().toISOString()
      });
    },
    [persistState, state]
  );

  const onCreateSession = useCallback(() => {
    const timestamp = new Date().toISOString();
    const nextSession: SessionRecord = {
      id: `session-${Date.now()}`,
      spaceId: state.activeSpaceId,
      label: createSessionLabel(sessionsForActiveSpace.length),
      contextProvider: activeSpace?.contextProvider,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    void persistState({
      ...state,
      sessions: [...state.sessions, nextSession],
      activeSessionId: nextSession.id,
      lastOpenedAt: timestamp
    });
  }, [activeSpace?.contextProvider, persistState, sessionsForActiveSpace.length, state]);

  const onOpenCreateSpaceForm = useCallback(() => {
    setIsCreateSpaceOpen(true);
    setSpaceErrors({});
    setSpaceDraft((currentDraft) => {
      if (currentDraft.name.trim()) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        name: suggestSpaceNameFromPrompt(spacePrompt)
      };
    });
  }, [spacePrompt]);

  const onRunOrchestrator = useCallback(async () => {
    const prompt = spacePrompt.trim();
    if (!activeSpace || !activeSession || prompt.length === 0) {
      return;
    }

    const startedAt = new Date().toISOString();
    const runId = createOrchestratorRunId();
    const queuedRun: OrchestratorRunRecord = {
      id: runId,
      spaceId: activeSpace.id,
      sessionId: activeSession.id,
      prompt,
      status: "queued",
      statusTimeline: ["queued"],
      createdAt: startedAt,
      updatedAt: startedAt
    };

    const queuedState: AppState = {
      ...state,
      orchestratorRuns: [...state.orchestratorRuns, queuedRun],
      lastOpenedAt: startedAt
    };
    await persistState(queuedState);

    const runningAt = new Date().toISOString();
    const runningTransition = transitionOrchestratorRunStatus(queuedRun, "running", runningAt);
    if (!runningTransition.ok) {
      console.error(runningTransition.reason);
      const failedAt = new Date().toISOString();
      const failedRun: OrchestratorRunRecord = {
        ...queuedRun,
        status: "failed",
        statusTimeline: ["queued", "running", "failed"],
        updatedAt: failedAt,
        completedAt: failedAt,
        errorMessage: runningTransition.reason
      };
      await persistState({
        ...queuedState,
        orchestratorRuns: queuedState.orchestratorRuns.map((run) => (run.id === runId ? failedRun : run)),
        lastOpenedAt: failedAt
      });
      return;
    }

    const runningRun = runningTransition.run;
    const runningState: AppState = {
      ...queuedState,
      orchestratorRuns: queuedState.orchestratorRuns.map((run) =>
        run.id === runId ? runningRun : run
      ),
      lastOpenedAt: runningAt
    };
    await persistState(runningState);

    const contextProviderId = resolveContextProviderId(
      activeSpace.contextProvider,
      activeSession.contextProvider
    );
    let contextSnippets: ContextSnippet[] = [];
    if (window.kataShell) {
      try {
        contextSnippets = await window.kataShell.retrieveContext({
          prompt,
          rootPath: activeSpace.rootPath,
          spaceId: activeSpace.id,
          sessionId: activeSession.id,
          providerId: contextProviderId,
          limit: 3
        });
      } catch (error) {
        console.error("Failed to retrieve context snippets.", error);
        contextSnippets = [];
      }
    }
    const endedAt = new Date().toISOString();

    const runFailureMessage = resolveRunFailure(prompt);
    const delegationOutcome = runFailureMessage
      ? { tasks: undefined, failureMessage: runFailureMessage }
      : buildDelegatedTaskTimeline(runId, prompt, endedAt);
    const failureMessage = delegationOutcome.failureMessage;
    const endedStatus: OrchestratorRunStatus = failureMessage ? "failed" : "completed";
    const endedTransition = transitionOrchestratorRunStatus(
      runningRun,
      endedStatus,
      endedAt,
      failureMessage ?? undefined
    );
    if (!endedTransition.ok) {
      console.error(endedTransition.reason);
      const failedRun: OrchestratorRunRecord = {
        ...runningRun,
        status: "failed",
        statusTimeline: runningRun.statusTimeline.includes("failed")
          ? runningRun.statusTimeline
          : [...runningRun.statusTimeline, "failed"],
        updatedAt: endedAt,
        completedAt: endedAt,
        errorMessage: endedTransition.reason,
        delegatedTasks: delegationOutcome.tasks
      };
      await persistState({
        ...runningState,
        orchestratorRuns: runningState.orchestratorRuns.map((run) => (run.id === runId ? failedRun : run)),
        lastOpenedAt: endedAt
      });
      return;
    }

    const endedRun = endedTransition.run;
    const draft = failureMessage ? undefined : createSpecDraft(endedRun, endedAt, contextSnippets);
    const endedState: AppState = {
      ...runningState,
      orchestratorRuns: runningState.orchestratorRuns.map((run) =>
        run.id === runId
          ? {
              ...endedRun,
              contextSnippets: failureMessage ? undefined : contextSnippets,
              draft,
              draftAppliedAt: undefined,
              draftApplyError: undefined,
              delegatedTasks: delegationOutcome.tasks
            }
          : run
      ),
      lastOpenedAt: endedAt
    };
    await persistState(endedState);
  }, [activeSession, activeSpace, persistState, spacePrompt, state]);

  const onSpecDraftApplied = useCallback(
    async (runId: string, status: "applied" | "failed", message?: string) => {
      const run = state.orchestratorRuns.find((entry) => entry.id === runId);
      if (!run) {
        return;
      }

      const nextUpdatedAt = new Date().toISOString();
      const nextState: AppState = {
        ...state,
        orchestratorRuns: state.orchestratorRuns.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                updatedAt: nextUpdatedAt,
                draftAppliedAt: status === "applied" ? nextUpdatedAt : entry.draftAppliedAt,
                draftApplyError: status === "failed" ? message ?? "Failed to apply draft." : undefined
              }
            : entry
        ),
        lastOpenedAt: nextUpdatedAt
      };

      await persistState(nextState);
    },
    [persistState, state]
  );

  const onCancelCreateSpaceForm = useCallback(() => {
    setIsCreateSpaceOpen(false);
    setSpaceErrors({});
  }, []);

  const onCreateSpaceFromPrompt = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const candidateInput: CreateSpaceInput = {
        prompt: spacePrompt,
        name: spaceDraft.name,
        path: spaceDraft.path,
        repo: spaceDraft.repo,
        description: spaceDraft.description,
        tags: parseTags(spaceDraft.tags)
      };

      const errors = validateCreateSpaceInput(
        candidateInput,
        state.spaces.map(toSpaceMetadata)
      );
      if (Object.keys(errors).length > 0) {
        setSpaceErrors(errors);
        return;
      }

      const now = new Date().toISOString();
      const newSpaceId = createSpaceId();
      const newSessionId = `session-${Date.now()}`;
      const sanitizedTags = (candidateInput.tags ?? []).map((tag) => tag.toLowerCase());

      const newSpace: SpaceRecord = {
        id: newSpaceId,
        name: candidateInput.name.trim(),
        rootPath: candidateInput.path.trim(),
        repoUrl: candidateInput.repo?.trim() || undefined,
        description: candidateInput.description?.trim() ?? "",
        tags: sanitizedTags,
        contextProvider: "filesystem",
        createdAt: now,
        updatedAt: now
      };

      const newSession: SessionRecord = {
        id: newSessionId,
        spaceId: newSpaceId,
        label: "Initial Orchestrator Session",
        contextProvider: "filesystem",
        createdAt: now,
        updatedAt: now
      };

      void persistState({
        ...state,
        spaces: [...state.spaces, newSpace],
        sessions: [...state.sessions, newSession],
        activeSpaceId: newSpaceId,
        activeSessionId: newSessionId,
        activeView: "orchestrator",
        lastOpenedAt: now
      });

      setIsCreateSpaceOpen(false);
      setSpaceErrors({});
      setSpacePrompt("");
      setSpaceDraft(EMPTY_CREATE_SPACE_DRAFT);
    },
    [persistState, spaceDraft, spacePrompt, state]
  );

  const onNavigateBrowser = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
        const normalizedUrl = normalizeLocalPreviewUrl(browserInput);
        setBrowserNavigation((currentState) => navigateBrowserHistory(currentState, normalizedUrl));
        setBrowserInput(normalizedUrl);
        setBrowserError(null);
      } catch (error) {
        setBrowserError(error instanceof Error ? error.message : "Invalid localhost URL.");
      }
    },
    [browserInput]
  );

  const onStepBrowserHistory = useCallback((direction: "back" | "forward") => {
    setBrowserNavigation((currentState) => {
      const nextState = stepBrowserHistory(currentState, direction);
      const nextUrl = nextState.entries[nextState.index];
      if (nextUrl) {
        setBrowserInput(nextUrl);
      }
      return nextState;
    });
    setBrowserError(null);
  }, []);

  const onRefreshBrowser = useCallback(() => {
    setBrowserRefreshKey((current) => current + 1);
    setBrowserError(null);
  }, []);

  const onOpenEditSpaceForm = useCallback((space: SpaceRecord) => {
    setEditingSpaceId(space.id);
    setEditSpaceErrors({});
    setEditSpaceDraft({
      name: space.name,
      path: space.rootPath,
      repo: space.repoUrl ?? "",
      description: space.description,
      tags: space.tags.join(", ")
    });
  }, []);

  const onCancelEditSpaceForm = useCallback(() => {
    setEditingSpaceId(null);
    setEditSpaceErrors({});
    setEditSpaceDraft(EMPTY_CREATE_SPACE_DRAFT);
  }, []);

  const onSaveEditedSpaceMetadata = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!editingSpaceId) {
        return;
      }

      const candidateInput: CreateSpaceInput = {
        prompt: "",
        name: editSpaceDraft.name,
        path: editSpaceDraft.path,
        repo: editSpaceDraft.repo,
        description: editSpaceDraft.description,
        tags: parseTags(editSpaceDraft.tags)
      };

      const validationPool = state.spaces
        .filter((space) => space.id !== editingSpaceId)
        .map(toSpaceMetadata);
      const errors = validateCreateSpaceInput(candidateInput, validationPool);
      if (Object.keys(errors).length > 0) {
        setEditSpaceErrors(errors);
        return;
      }

      const now = new Date().toISOString();
      const sanitizedTags = (candidateInput.tags ?? []).map((tag) => tag.toLowerCase());
      void persistState({
        ...state,
        spaces: state.spaces.map((space) =>
          space.id === editingSpaceId
            ? {
                ...space,
                name: candidateInput.name.trim(),
                rootPath: candidateInput.path.trim(),
                repoUrl: candidateInput.repo?.trim() || undefined,
                description: candidateInput.description?.trim() ?? "",
                tags: sanitizedTags,
                updatedAt: now
              }
            : space
        ),
        lastOpenedAt: now
      });

      setEditingSpaceId(null);
      setEditSpaceErrors({});
      setEditSpaceDraft(EMPTY_CREATE_SPACE_DRAFT);
    },
    [editSpaceDraft, editingSpaceId, persistState, state]
  );

  if (isBootstrapping) {
    return (
      <main className="loading-screen">
        <p>Bootstrapping Kata Cloud shell...</p>
      </main>
    );
  }

  return (
    <main className="shell-app">
      <header className="shell-header">
        <div>
          <h1>Kata Cloud</h1>
          <p>Electron shell bootstrap</p>
        </div>
        <nav className="view-nav">
          {viewOrder.map((view) => (
            <button
              key={view}
              type="button"
              className={view === state.activeView ? "nav-button is-active" : "nav-button"}
              onClick={() => onViewSelect(view)}
            >
              {toViewLabel(view)}
            </button>
          ))}
        </nav>
      </header>

      <div className="status-row">
        <span>Current view: {toViewLabel(state.activeView)}</span>
        <span>{isSaving ? "Saving state..." : "State synced"}</span>
      </div>

      <section className="panel-grid">
        <section className={state.activeView === "explorer" ? "panel panel-focused" : "panel"}>
          <header className="panel-header">
            <h2>Explorer</h2>
            <p>Spaces and session index</p>
          </header>
          <div className="panel-body">
            <div className="space-list">
              {state.spaces.map((space) => {
                const gitUiState = toSpaceGitUiState(space.gitStatus);
                return (
                  <button
                    type="button"
                    key={space.id}
                    className={space.id === state.activeSpaceId ? "space-card is-active" : "space-card"}
                    onClick={() => onSpaceSelect(space)}
                  >
                    <span className="space-title">{space.name}</span>
                    <span className="space-path">{space.rootPath}</span>
                    <span className={gitUiState.isError ? "space-git-summary is-error" : "space-git-summary"}>
                      {gitUiState.title}: {gitUiState.detail}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="session-section">
              <div className="session-header">
                <h3>Sessions</h3>
                <button type="button" className="pill-button" onClick={onCreateSession}>
                  New Session
                </button>
              </div>
              <ul className="session-list">
                {sessionsForActiveSpace.map((session) => (
                  <li
                    key={session.id}
                    className={session.id === state.activeSessionId ? "session-item is-active" : "session-item"}
                  >
                    {session.label}
                  </li>
                ))}
              </ul>
            </div>

            {activeSpace ? (
              <div className="space-create">
                <div className="space-create__actions">
                  <button
                    type="button"
                    className="pill-button"
                    onClick={() => onOpenEditSpaceForm(activeSpace)}
                  >
                    Edit Space Metadata
                  </button>
                </div>

                {editingSpaceId === activeSpace.id ? (
                  <form className="space-create__form" onSubmit={onSaveEditedSpaceMetadata}>
                    <label htmlFor="edit-space-name-input">
                      Space Name
                      <input
                        id="edit-space-name-input"
                        value={editSpaceDraft.name}
                        onChange={(event) =>
                          setEditSpaceDraft((currentDraft) => ({
                            ...currentDraft,
                            name: event.target.value
                          }))
                        }
                      />
                      {editSpaceErrors.name ? (
                        <span className="field-error">{editSpaceErrors.name}</span>
                      ) : null}
                    </label>

                    <label htmlFor="edit-space-path-input">
                      Workspace Root Path
                      <input
                        id="edit-space-path-input"
                        value={editSpaceDraft.path}
                        onChange={(event) =>
                          setEditSpaceDraft((currentDraft) => ({
                            ...currentDraft,
                            path: event.target.value
                          }))
                        }
                      />
                      {editSpaceErrors.path ? (
                        <span className="field-error">{editSpaceErrors.path}</span>
                      ) : null}
                    </label>

                    <label htmlFor="edit-space-repo-input">
                      Repo Link (optional)
                      <input
                        id="edit-space-repo-input"
                        value={editSpaceDraft.repo}
                        onChange={(event) =>
                          setEditSpaceDraft((currentDraft) => ({
                            ...currentDraft,
                            repo: event.target.value
                          }))
                        }
                      />
                      {editSpaceErrors.repo ? (
                        <span className="field-error">{editSpaceErrors.repo}</span>
                      ) : null}
                    </label>

                    <label htmlFor="edit-space-description-input">
                      Description (optional)
                      <textarea
                        id="edit-space-description-input"
                        value={editSpaceDraft.description}
                        onChange={(event) =>
                          setEditSpaceDraft((currentDraft) => ({
                            ...currentDraft,
                            description: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label htmlFor="edit-space-tags-input">
                      Tags (optional)
                      <input
                        id="edit-space-tags-input"
                        value={editSpaceDraft.tags}
                        onChange={(event) =>
                          setEditSpaceDraft((currentDraft) => ({
                            ...currentDraft,
                            tags: event.target.value
                          }))
                        }
                      />
                    </label>

                    <div className="space-create__actions">
                      <button type="submit" className="pill-button">
                        Save Metadata
                      </button>
                      <button type="button" className="pill-button" onClick={onCancelEditSpaceForm}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className={state.activeView === "orchestrator" ? "panel panel-focused" : "panel"}>
          <header className="panel-header">
            <h2>Orchestrator</h2>
            <p>Coordination and specialist execution</p>
          </header>
          <div className="panel-body">
            <div className="space-create">
              <label htmlFor="space-prompt-input">
                Project Prompt
                <textarea
                  id="space-prompt-input"
                  value={spacePrompt}
                  onChange={(event) => setSpacePrompt(event.target.value)}
                  placeholder="Describe your project and use it to bootstrap a new space..."
                />
              </label>
              <div className="space-create__actions">
                <button type="button" className="pill-button" onClick={onOpenCreateSpaceForm}>
                  Create Space
                </button>
                <button
                  type="button"
                  className="pill-button"
                  disabled={!activeSpace || !activeSession || !spacePrompt.trim() || isSaving}
                  onClick={() => {
                    void onRunOrchestrator();
                  }}
                >
                  Run Orchestrator
                </button>
              </div>

              {isCreateSpaceOpen ? (
                <form className="space-create__form" onSubmit={onCreateSpaceFromPrompt}>
                  <label htmlFor="space-name-input">
                    Space Name
                    <input
                      id="space-name-input"
                      value={spaceDraft.name}
                      onChange={(event) =>
                        setSpaceDraft((currentDraft) => ({
                          ...currentDraft,
                          name: event.target.value
                        }))
                      }
                    />
                    {spaceErrors.name ? <span className="field-error">{spaceErrors.name}</span> : null}
                  </label>

                  <label htmlFor="space-path-input">
                    Workspace Root Path
                    <input
                      id="space-path-input"
                      value={spaceDraft.path}
                      onChange={(event) =>
                        setSpaceDraft((currentDraft) => ({
                          ...currentDraft,
                          path: event.target.value
                        }))
                      }
                      placeholder="/Users/me/dev/my-project"
                    />
                    {spaceErrors.path ? <span className="field-error">{spaceErrors.path}</span> : null}
                  </label>

                  <label htmlFor="space-repo-input">
                    Repo Link (optional)
                    <input
                      id="space-repo-input"
                      value={spaceDraft.repo}
                      onChange={(event) =>
                        setSpaceDraft((currentDraft) => ({
                          ...currentDraft,
                          repo: event.target.value
                        }))
                      }
                      placeholder="https://github.com/org/repo"
                    />
                    {spaceErrors.repo ? <span className="field-error">{spaceErrors.repo}</span> : null}
                  </label>

                  <label htmlFor="space-description-input">
                    Description (optional)
                    <textarea
                      id="space-description-input"
                      value={spaceDraft.description}
                      onChange={(event) =>
                        setSpaceDraft((currentDraft) => ({
                          ...currentDraft,
                          description: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label htmlFor="space-tags-input">
                    Tags (optional)
                    <input
                      id="space-tags-input"
                      value={spaceDraft.tags}
                      onChange={(event) =>
                        setSpaceDraft((currentDraft) => ({
                          ...currentDraft,
                          tags: event.target.value
                        }))
                      }
                      placeholder="frontend, orchestrator"
                    />
                  </label>

                  <div className="space-create__actions">
                    <button type="submit" className="pill-button">
                      Save Space
                    </button>
                    <button type="button" className="pill-button" onClick={onCancelCreateSpaceForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="info-card">
              <h3>Active Space</h3>
              <p>{activeSpace?.name ?? "No active space"}</p>
            </div>
            <div className="info-card">
              <h3>Active Session</h3>
              <p>{activeSession?.label ?? "No active session"}</p>
            </div>
            <div className="info-card">
              <h3>Status</h3>
              <p>
                {latestRunViewModel
                  ? `Run ${latestRunViewModel.id} is ${latestRunViewModel.statusLabel}.`
                  : "No orchestrator runs yet."}
              </p>
              {/* latestRunViewModel is derived from latestRunForActiveSession; both are null/non-null
                  simultaneously. Draft fields (draft, draftAppliedAt, draftApplyError) are not projected
                  into the view model, so the raw record is used for those fields only. */}
              {latestRunViewModel && latestRunForActiveSession ? (
                <>
                  <p>Prompt: {latestRunViewModel.prompt}</p>
                  <p>Lifecycle: {latestRunViewModel.lifecycleText}</p>
                  {latestRunViewModel.delegatedTasks.length > 0 ? (
                    <div>
                      <p>Delegated tasks</p>
                      <ul>
                        {latestRunViewModel.delegatedTasks.map((task) => (
                          <li key={task.id}>
                            {task.type} ({task.specialist}): {task.status} [{task.lifecycleText}]
                            {task.errorMessage ? (
                              <>
                                {" "}
                                - <span className="field-error">{task.errorMessage}</span>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {latestRunForActiveSession.draft ? (
                    <p>Draft: ready for run {latestRunForActiveSession.draft.runId}</p>
                  ) : null}
                  {latestRunForActiveSession.draftAppliedAt ? (
                    <p>Draft applied at {new Date(latestRunForActiveSession.draftAppliedAt).toLocaleString()}</p>
                  ) : null}
                  {latestRunViewModel.errorMessage ? (
                    <p className="field-error">{latestRunViewModel.errorMessage}</p>
                  ) : null}
                  {latestRunForActiveSession.draftApplyError ? (
                    <p className="field-error">{latestRunForActiveSession.draftApplyError}</p>
                  ) : null}
                </>
              ) : null}
            </div>
            {latestRunForActiveSession ? (
              <div className="info-card">
                <h3>Latest Run ID</h3>
                <p>{latestRunForActiveSession.id}</p>
              </div>
            ) : null}
            {priorRunHistoryViewModels.length > 0 ? (
              <div className="info-card">
                <h3>Run History</h3>
                <ul>
                  {priorRunHistoryViewModels.map((run) => (
                    <li key={run.id}>
                      <p>
                        <strong>{run.id}</strong> - {run.status}
                      </p>
                      <p>Prompt: {run.prompt}</p>
                      <p>Lifecycle: {run.lifecycleText}</p>
                      {run.delegatedTasks.length > 0 ? (
                        <div>
                          <p>Delegated tasks</p>
                          <ul>
                            {run.delegatedTasks.map((task) => (
                              <li key={task.id}>
                                {task.type} ({task.specialist}): {task.status} [{task.lifecycleText}]
                                {task.errorMessage ? (
                                  <>
                                    {" "}
                                    - <span className="field-error">{task.errorMessage}</span>
                                  </>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {run.errorMessage ? <p className="field-error">{run.errorMessage}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section
          className={
            state.activeView === "spec" || state.activeView === "changes" || state.activeView === "browser"
              ? "panel panel-focused"
              : "panel"
          }
        >
          <header className="panel-header">
            <h2>
              {state.activeView === "changes"
                ? "Changes"
                : state.activeView === "browser"
                  ? "Browser"
                  : "Spec"}
            </h2>
            <p>
              {state.activeView === "changes"
                ? "Diff and staging entrypoint"
                : state.activeView === "browser"
                  ? "Preview local development targets"
                  : "Project source of truth and collaboration"}
            </p>
          </header>
          <div className="panel-body">
            {state.activeView === "changes" ? (
              <>
                <div className="info-card">
                  <h3>Changes View</h3>
                  <p>Inspect diffs and stage/unstage selected files for the active space.</p>
                </div>
                <div className="info-card">
                  <h3>Branch / Worktree</h3>
                  {activeSpace ? (
                    <>
                      <p>
                        {activeSpaceGitUiState?.title}: {activeSpaceGitUiState?.detail}
                      </p>
                      {activeSpaceGitUiState?.branchName ? (
                        <p>Branch: {activeSpaceGitUiState.branchName}</p>
                      ) : null}
                      {activeSpaceGitUiState?.worktreePath ? (
                        <p>Worktree: {activeSpaceGitUiState.worktreePath}</p>
                      ) : null}
                      {activeSpaceGitUiState?.remediation ? (
                        <p className="field-error">{activeSpaceGitUiState.remediation}</p>
                      ) : null}
                      {activeChangesRepoPath ? (
                        <div className="space-create__actions">
                          <button
                            type="button"
                            className="pill-button"
                            disabled={
                              activeGitOperationSpaceId === activeSpace.id || !activeChangesRepoPath
                            }
                            onClick={() => {
                              void runSpaceGitLifecycle(activeSpace, "initialize");
                            }}
                          >
                            Initialize Branch/Worktree
                          </button>
                          <button
                            type="button"
                            className="pill-button"
                            disabled={
                              activeGitOperationSpaceId === activeSpace.id || !activeChangesRepoPath
                            }
                            onClick={() => {
                              void runSpaceGitLifecycle(activeSpace, "switch");
                            }}
                          >
                            Switch Branch/Worktree
                          </button>
                          <button
                            type="button"
                            className="pill-button"
                            disabled={!activeChangesRepoPath || isLoadingChanges}
                            onClick={() => {
                              void loadChangesSnapshot();
                            }}
                          >
                            {isLoadingChanges ? "Refreshing..." : "Refresh Changes"}
                          </button>
                        </div>
                      ) : (
                        <p>Select a workspace root path to enable git lifecycle actions.</p>
                      )}
                    </>
                  ) : (
                    <p>No active space selected.</p>
                  )}
                </div>
                {activeSpace && activeChangesRepoPath ? (
                  <>
                    <div className="info-card">
                      <h3>Staged Summary</h3>
                      {changesSnapshot ? (
                        <>
                          <p>
                            Files: {changesSnapshot.stagedSummary.fileCount} staged /{" "}
                            {changesSnapshot.unstagedFileCount} unstaged
                          </p>
                          <p>
                            Added {changesSnapshot.stagedSummary.added}, Modified{" "}
                            {changesSnapshot.stagedSummary.modified}, Deleted{" "}
                            {changesSnapshot.stagedSummary.deleted}
                          </p>
                          <p>
                            Renamed {changesSnapshot.stagedSummary.renamed}, Copied{" "}
                            {changesSnapshot.stagedSummary.copied}, Conflicts{" "}
                            {changesSnapshot.stagedSummary.conflicted}
                          </p>
                          <p>
                            Staged lines +{changesSnapshot.stagedSummary.insertions} / -
                            {changesSnapshot.stagedSummary.deletions}
                          </p>
                        </>
                      ) : (
                        <p>{isLoadingChanges ? "Loading changes..." : "No changes loaded."}</p>
                      )}
                      {changesError ? <p className="field-error">{changesError}</p> : null}
                    </div>
                    <div className="info-card pull-request-card">
                      <h3>Pull Request</h3>
                      <p>Generate a suggested title/body from staged diff + spec context, then submit to GitHub.</p>
                      <p>
                        Generated diff snippets apply basic redaction/suppression guardrails; review for sensitive
                        content before submitting.
                      </p>
                      <p>Repository: {activeSpace.repoUrl}</p>
                      <p>
                        GitHub session:{" "}
                        {githubSession ? `connected as ${githubSession.login}` : "not connected"}
                      </p>
                      {!githubSession ? (
                        <label htmlFor="github-token-input">
                          GitHub Token
                          <input
                            id="github-token-input"
                            type="password"
                            value={githubTokenInput}
                            onChange={(event) => setGitHubTokenInput(event.target.value)}
                            placeholder="ghp_..."
                          />
                        </label>
                      ) : null}
                      <label htmlFor="pr-base-branch-input">
                        Base Branch
                        <input
                          id="pr-base-branch-input"
                          value={pullRequestBaseBranch}
                          onChange={(event) => setPullRequestBaseBranch(event.target.value)}
                          placeholder="main"
                        />
                      </label>
                      <label htmlFor="pr-title-input">
                        PR Title
                        <input
                          id="pr-title-input"
                          value={pullRequestTitle}
                          onChange={(event) => setPullRequestTitle(event.target.value)}
                          placeholder="feat: ..."
                        />
                      </label>
                      <label htmlFor="pr-body-input">
                        PR Body
                        <textarea
                          id="pr-body-input"
                          value={pullRequestBody}
                          onChange={(event) => setPullRequestBody(event.target.value)}
                          rows={12}
                        />
                      </label>
                      <div className="space-create__actions">
                        {githubSession ? (
                          <button
                            type="button"
                            className="pill-button"
                            disabled={isConnectingGitHub}
                            onClick={() => {
                              void onDisconnectGitHub();
                            }}
                          >
                            Disconnect GitHub
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="pill-button"
                            disabled={isConnectingGitHub || !githubTokenInput.trim()}
                            onClick={() => {
                              void onConnectGitHub();
                            }}
                          >
                            {isConnectingGitHub ? "Connecting..." : "Connect GitHub"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="pill-button"
                          disabled={isGeneratingPullRequestDraft || !changesSnapshot?.hasStagedChanges}
                          onClick={() => {
                            void onGeneratePullRequestDraft();
                          }}
                        >
                          {isGeneratingPullRequestDraft ? "Generating..." : "Generate PR Suggestion"}
                        </button>
                        <button
                          type="button"
                          className="pill-button"
                          disabled={
                            isCreatingPullRequest ||
                            !githubSession ||
                            !pullRequestTitle.trim() ||
                            !pullRequestBaseBranch.trim()
                          }
                          onClick={() => {
                            void onCreatePullRequest();
                          }}
                        >
                          {isCreatingPullRequest ? "Creating PR..." : "Create Pull Request"}
                        </button>
                        {createdPullRequest ? (
                          <button
                            type="button"
                            className="pill-button"
                            onClick={() => {
                              void onOpenCreatedPullRequest();
                            }}
                          >
                            Open PR
                          </button>
                        ) : null}
                      </div>
                      {pullRequestDraft ? (
                        <p>
                          Draft generated for {pullRequestDraft.headBranch} → {pullRequestDraft.baseBranch}.
                        </p>
                      ) : null}
                      {createdPullRequest ? (
                        <p>
                          Created PR #{createdPullRequest.number}: {createdPullRequest.url}
                        </p>
                      ) : null}
                      {pullRequestStatusMessage ? (
                        <p
                          className={
                            /failed|unable|error/i.test(pullRequestStatusMessage)
                              ? "field-error"
                              : undefined
                          }
                        >
                          {pullRequestStatusMessage}
                        </p>
                      ) : null}
                    </div>
                    <div className="changes-layout">
                      <section className="changes-files">
                        <header>
                          <h3>Files</h3>
                          <p>{changesSnapshot?.files.length ?? 0} changed file(s)</p>
                        </header>
                        {changesSnapshot && changesSnapshot.files.length > 0 ? (
                          <ul className="changes-file-list">
                            {changesSnapshot.files.map((change) => {
                              const isSelected = selectedChangePath === change.path;
                              const canStage = isUnstagedFileChange(change);
                              const canUnstage = isStagedFileChange(change);
                              const stageActionKey = `stage:${change.path}`;
                              const unstageActionKey = `unstage:${change.path}`;
                              return (
                                <li
                                  key={`${change.statusCode}:${change.path}`}
                                  className={isSelected ? "changes-file is-selected" : "changes-file"}
                                >
                                  <button
                                    type="button"
                                    className="changes-file__select"
                                    onClick={() => {
                                      setSelectedChangePath(change.path);
                                    }}
                                  >
                                    {toChangePathLabel(change)}
                                  </button>
                                  <div className="changes-file__meta">
                                    {isStagedFileChange(change) ? (
                                      <span className="changes-pill is-staged">
                                        Staged: {toGitStatusLabel(change.stagedStatus)}
                                      </span>
                                    ) : null}
                                    {isUnstagedFileChange(change) ? (
                                      <span className="changes-pill is-unstaged">
                                        Unstaged: {toGitStatusLabel(change.unstagedStatus)}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="space-create__actions">
                                    {canStage ? (
                                      <button
                                        type="button"
                                        className="pill-button"
                                        disabled={activeFileActionKey === stageActionKey}
                                        onClick={() => {
                                          void onRunFileStageAction(change.path, "stage");
                                        }}
                                      >
                                        {activeFileActionKey === stageActionKey ? "Staging..." : "Stage"}
                                      </button>
                                    ) : null}
                                    {canUnstage ? (
                                      <button
                                        type="button"
                                        className="pill-button"
                                        disabled={activeFileActionKey === unstageActionKey}
                                        onClick={() => {
                                          void onRunFileStageAction(change.path, "unstage");
                                        }}
                                      >
                                        {activeFileActionKey === unstageActionKey ? "Unstaging..." : "Unstage"}
                                      </button>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p>{isLoadingChanges ? "Loading files..." : "Working tree is clean."}</p>
                        )}
                      </section>
                      <section className="changes-diff">
                        <header>
                          <h3>Diff</h3>
                          <p>{selectedChange ? toChangePathLabel(selectedChange) : "Select a file"}</p>
                        </header>
                        {selectedChange ? (
                          <>
                            {isLoadingFileDiff ? <p>Loading diff...</p> : null}
                            {isStagedFileChange(selectedChange) ? (
                              <article className="changes-diff__panel">
                                <h4>Staged</h4>
                                <DiffText value={selectedFileDiff?.stagedDiff ?? "No staged diff for this file."} />
                              </article>
                            ) : null}
                            {isUnstagedFileChange(selectedChange) ? (
                              <article className="changes-diff__panel">
                                <h4>Unstaged</h4>
                                <DiffText
                                  value={selectedFileDiff?.unstagedDiff ?? "No unstaged diff for this file."}
                                />
                              </article>
                            ) : null}
                          </>
                        ) : (
                          <p>Select a changed file to inspect its diff.</p>
                        )}
                      </section>
                    </div>
                  </>
                ) : null}
              </>
            ) : state.activeView === "browser" ? (
              <>
                <form className="browser-controls" onSubmit={onNavigateBrowser}>
                  <label className="browser-controls__url" htmlFor="browser-url-input">
                    Local URL
                    <input
                      id="browser-url-input"
                      value={browserInput}
                      onChange={(event) => setBrowserInput(event.target.value)}
                      placeholder="http://localhost:3000"
                    />
                  </label>
                  <div className="browser-controls__actions">
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => onStepBrowserHistory("back")}
                      disabled={!canGoBack}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="pill-button"
                      onClick={() => onStepBrowserHistory("forward")}
                      disabled={!canGoForward}
                    >
                      Forward
                    </button>
                    <button type="button" className="pill-button" onClick={onRefreshBrowser}>
                      Refresh
                    </button>
                    <button type="submit" className="pill-button">
                      Go
                    </button>
                  </div>
                </form>
                {browserError ? <p className="field-error">{browserError}</p> : null}
                <div className="browser-frame-shell">
                  <p className="browser-frame-shell__url">{currentBrowserUrl}</p>
                  <iframe
                    key={`${currentBrowserUrl}-${browserRefreshKey}`}
                    className="browser-frame"
                    src={currentBrowserUrl}
                    title="Local development preview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                </div>
              </>
            ) : (
              <SpecNotePanel
                storage={window.localStorage}
                draftArtifact={latestDraftForActiveSession}
                onApplyDraftResult={onSpecDraftApplied}
              />
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(appRoot).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
