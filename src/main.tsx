import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createSpaceGitRequest,
  createSpaceGitStatus,
  type SpaceGitLifecycleRequest,
  type SpaceGitLifecycleStatus
} from "./git/types";
import { toSpaceGitUiState } from "./git/space-git-ui-state";
import { SpecNotePanel } from "./notes/spec-note-panel";
import {
  AppState,
  NavigationView,
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
import "./styles.css";

const appRoot = document.getElementById("app");

if (!appRoot) {
  throw new Error("Missing #app root element.");
}

const LOCAL_FALLBACK_KEY = "kata-cloud.local-state.v1";

const viewOrder: NavigationView[] = ["explorer", "orchestrator", "spec", "changes"];

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
    default:
      return view;
  }
}

function createSessionLabel(existingCount: number): string {
  return `Session ${existingCount + 1}`;
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

function App(): JSX.Element {
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
      if (!space.repoUrl) {
        return;
      }

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

  const activeSession = useMemo(
    () => state.sessions.find((session) => session.id === state.activeSessionId),
    [state.activeSessionId, state.sessions]
  );

  const sessionsForActiveSpace = useMemo(
    () => state.sessions.filter((session) => session.spaceId === state.activeSpaceId),
    [state.activeSpaceId, state.sessions]
  );

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
      createdAt: timestamp,
      updatedAt: timestamp
    };

    void persistState({
      ...state,
      sessions: [...state.sessions, nextSession],
      activeSessionId: nextSession.id,
      lastOpenedAt: timestamp
    });
  }, [persistState, sessionsForActiveSpace.length, state]);

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
        createdAt: now,
        updatedAt: now
      };

      const newSession: SessionRecord = {
        id: newSessionId,
        spaceId: newSpaceId,
        label: "Initial Orchestrator Session",
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
              <p>Agent execution is intentionally out of scope for shell bootstrap.</p>
            </div>
          </div>
        </section>

        <section
          className={
            state.activeView === "spec" || state.activeView === "changes" ? "panel panel-focused" : "panel"
          }
        >
          <header className="panel-header">
            <h2>{state.activeView === "changes" ? "Changes" : "Spec"}</h2>
            <p>
              {state.activeView === "changes"
                ? "Diff and staging entrypoint"
                : "Project source of truth and collaboration"}
            </p>
          </header>
          <div className="panel-body">
            {state.activeView === "changes" ? (
              <>
                <div className="info-card">
                  <h3>Changes View</h3>
                  <p>Inspect and apply branch/worktree setup for the active space.</p>
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
                      {activeSpace.repoUrl ? (
                        <div className="space-create__actions">
                          <button
                            type="button"
                            className="pill-button"
                            disabled={activeGitOperationSpaceId === activeSpace.id}
                            onClick={() => {
                              void runSpaceGitLifecycle(activeSpace, "initialize");
                            }}
                          >
                            Initialize Branch/Worktree
                          </button>
                          <button
                            type="button"
                            className="pill-button"
                            disabled={activeGitOperationSpaceId === activeSpace.id}
                            onClick={() => {
                              void runSpaceGitLifecycle(activeSpace, "switch");
                            }}
                          >
                            Switch Branch/Worktree
                          </button>
                        </div>
                      ) : (
                        <p>Link a repository when creating the space to enable git lifecycle actions.</p>
                      )}
                    </>
                  ) : (
                    <p>No active space selected.</p>
                  )}
                </div>
              </>
            ) : (
              <SpecNotePanel storage={window.localStorage} />
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
