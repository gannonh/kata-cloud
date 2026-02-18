# Architecture

**Analysis Date:** 2026-02-18

## Pattern Overview

**Overall:** Electron shell with strict process boundaries plus feature-oriented TypeScript modules

**Key Characteristics:**
- Main process owns filesystem, git, and provider integrations (`src/main/index.ts`, `src/git/*`, `src/main/provider-runtime/*`)
- Preload exposes a typed bridge (`window.kataShell`) and keeps renderer isolated from Electron APIs (`src/preload/index.ts`)
- Renderer consumes shell APIs and local domain helpers in a stateful React root (`src/main.tsx`)

## Layers

**Renderer layer:**
- Purpose: UI rendering, interaction flow, optimistic local state
- Location: `src/main.tsx`, `src/features/`, `src/space/`, `src/notes/`, `src/browser/`
- Contains: React components, local reducers/helpers, form validation
- Depends on: shared contracts from `src/shared/*`, shell bridge from `window.kataShell`
- Used by: Electron BrowserWindow renderer context

**Bridge layer (preload):**
- Purpose: Restrict and type IPC access
- Location: `src/preload/index.ts`
- Contains: channel constants and `ShellApi` implementation that proxies `ipcRenderer.invoke`
- Depends on: Electron preload globals and shared types (`src/shared/shell-api.ts`)
- Used by: renderer only through `window.kataShell`

**Main service layer:**
- Purpose: own side effects and domain services
- Location: `src/main/index.ts`, `src/main/persisted-state-store.ts`, `src/git/*`, `src/main/provider-runtime/*`, `src/context/*`
- Contains: IPC handlers, git orchestration, provider registry/execution, context retrieval
- Depends on: Node/Electron APIs and shared contracts
- Used by: preload IPC invocations

**Shared contract layer:**
- Purpose: type-safe contracts across process boundaries
- Location: `src/shared/state.ts`, `src/shared/shell-api.ts`, `src/git/types.ts`, `src/context/types.ts`
- Contains: AppState schema + normalization guards, IPC channel names, request/response interfaces
- Depends on: pure TypeScript only
- Used by: main + preload + renderer

## Data Flow

**State persistence flow:**

1. Main initializes persisted state from disk (`src/main/persisted-state-store.ts`)
2. Renderer requests/saves via IPC (`kata-cloud/state:get`, `kata-cloud/state:save`)
3. Main normalizes/saves state and broadcasts `kata-cloud/state:changed`
4. Renderer subscribes and re-renders (`src/main.tsx` subscription effects)

**Git workflow flow:**

1. Renderer builds lifecycle request from selected space (`src/main.tsx`)
2. Main `SpaceGitLifecycleService` validates repo and orchestrates branch/worktree (`src/git/space-git-service.ts`)
3. Main returns lifecycle status + changes/diff snapshots
4. Renderer projects status via `toSpaceGitUiState` and updates Changes view

**Provider execution flow:**

1. Renderer sends provider auth/model/execute request over IPC
2. Main `ProviderRuntimeService` resolves adapter from registry (`src/main/provider-runtime/service.ts`)
3. Adapter delegates to provider-specific API client (`src/main/providers/*`)
4. Typed result/error returns to renderer

## Key Abstractions

**AppState contract:**
- Purpose: canonical persisted UI state
- Examples: `src/shared/state.ts`
- Pattern: strict runtime guards + normalization fallback

**ShellApi contract:**
- Purpose: typed IPC method surface for renderer
- Examples: `src/shared/shell-api.ts`, `src/preload/index.ts`
- Pattern: shared interface + preload implementation

**Domain services:**
- Purpose: isolate IO-heavy behavior from UI
- Examples: `src/git/space-git-service.ts`, `src/git/pr-workflow.ts`, `src/main/provider-runtime/service.ts`
- Pattern: class-based service with explicit request/response types

## Entry Points

**Desktop bootstrap:**
- Location: `src/main/index.ts`
- Triggers: Electron app startup
- Responsibilities: create window, initialize state/services, register IPC handlers

**Renderer bootstrap:**
- Location: `src/main.tsx`
- Triggers: Vite/web load
- Responsibilities: create React root, hold top-level UI state and workflows

**Preload bootstrap:**
- Location: `src/preload/index.ts`
- Triggers: BrowserWindow preload
- Responsibilities: expose `window.kataShell`

## Error Handling

**Strategy:** typed domain errors in service layers, fallback normalization for state inputs, defensive renderer error messaging

**Patterns:**
- Custom error codes/remediation objects in git and provider domains (`src/git/space-git-errors.ts`, `src/main/provider-runtime/errors.ts`)
- Graceful fallback reads/writes for local storage and persisted state (`src/main.tsx`, `src/main/persisted-state-store.ts`)

## Cross-Cutting Concerns

**Logging:** console-based diagnostics in main/services
**Validation:** runtime type guards + normalization before persistence/processing
**Authentication:** provider auth resolved per request; no global user auth subsystem

---

*Architecture analysis: 2026-02-18*
