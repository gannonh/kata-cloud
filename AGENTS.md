# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
`CLAUDE.md` is a symlink to this file for compatibility.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm run dev`: build Electron main, start Vite, then launch Electron (orchestrated by `scripts/dev-desktop.mjs`).
- `pnpm run web:dev`: run renderer only (Vite dev server on port 5173).
- `pnpm run build`: compile main process and bundle renderer assets.
- `pnpm run desktop:typecheck`: strict TS type checks for main + renderer configs.
- `pnpm run e2e`: run the full Electron end-to-end suite.
- `pnpm run e2e:electron:smoke`: run baseline Electron smoke guardrail (`window.kataShell` bridge + Changes wiring).
- `pnpm run e2e:electron:uat`: run UAT-derived Electron Playwright scenarios (currently no-repo-link Changes flow + PR redaction checks).
- `pnpm run uat:electron:smoke` / `pnpm run uat:electron:e2e`: compatibility aliases to the `e2e:*` commands.
- `pnpm run repo:guardrails`: run repository hygiene guardrails.
- `pnpm run lint`: lint all files with ESLint (flat config in `eslint.config.mjs`).
- `pnpm test`: run Vitest once.
- `pnpm run test:watch`: run Vitest in watch mode.
- `pnpm test -- <pattern>`: run tests matching a file pattern (e.g., `pnpm test -- state`).
- `pnpm test -- -t "test name pattern"`: run tests matching a test name.
- Before opening a PR, run: `pnpm test && pnpm run desktop:typecheck`.

## Architecture Overview

`kata-cloud` is a pnpm workspace centered on an Electron desktop app with a React 19 renderer.

### Electron Process Boundaries
- **Main process** (CommonJS, `src/main/index.ts`): IPC handlers, file system, git operations, persisted state. Outputs to `dist/`.
- **Preload** (`src/preload/index.ts`): Exposes typed `kataShell` API via `contextBridge`. Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **Renderer** (ESNext/Bundler, `src/main.tsx`): React 19 app. Communicates exclusively through `window.kataShell` — never imports Electron APIs directly.

### IPC & State Flow
IPC channels follow the `kata-cloud/<domain>:<action>` naming convention, defined in `src/shared/shell-api.ts`.

State flow:
1. Main process `PersistedStateStore` reads/writes `~/.config/kata-cloud/kata-cloud-state.json`
2. On change, broadcasts via `IPC_CHANNELS.stateChanged` to all windows
3. Renderer subscribes via `kataShell.subscribeState(listener)` and holds in React state
4. Renderer writes via `kataShell.saveState()` IPC call
5. Fallback: renderer stores to `localStorage` if shell is unavailable (web-only mode)

`AppState` (defined in `src/shared/state.ts`) is the central data contract:
- `spaces: SpaceRecord[]` — workspace definitions
- `sessions: SessionRecord[]` — work contexts per space
- `orchestratorRuns: OrchestratorRunRecord[]` — AI delegation history
- `activeView`, `activeSpaceId`, `activeSessionId` — UI navigation state

All incoming state is validated through `normalizeAppState()` with strict guard functions.

### kataShell API Surface
The preload bridge (`src/preload/index.ts`) exposes these async methods to the renderer:
- **State**: `getState()`, `saveState()`, `subscribeState()`
- **Git lifecycle**: `initializeSpaceGit()`, `switchSpaceGit()`, `getSpaceChanges()`, `getSpaceFileDiff()`, `stageSpaceFile()`, `unstageSpaceFile()`
- **GitHub workflow**: `createGitHubSession()`, `clearGitHubSession()`, `generatePullRequestDraft()`, `createPullRequest()`
- **System**: `openExternalUrl()`

### Feature Module Pattern
Each domain feature follows a consistent structure:
- `types.ts`: Domain types, request/response interfaces, type guards
- `validation.ts`: Input validation and normalization
- `store.ts`: State management helpers
- `*.test.ts`: Colocated tests (use `*.node.test.ts` suffix for Node-only tests)

Feature directories: `src/space/`, `src/git/`, `src/notes/`, `src/features/spec-panel/`.

### Git Domain (`src/git/`)
The git feature is the most complex domain. Key files:
- `git-cli.ts`: Shell command wrapper for git operations
- `space-git-service.ts`: High-level service (initialize, switch, stage)
- `changes.ts`: Parses `git status --porcelain` output
- `space-git-ui-state.ts`: Transforms `SpaceGitLifecycleStatus` (phases: initializing, switching, ready, error) to UI state
- `pr-workflow.ts`: GitHub API integration for pull requests

### Renderer Entry Point
`src/main.tsx` (~1770 lines) is a monolithic React component managing views (Explorer, Orchestrator, Spec, Changes), space/session CRUD, git operations, PR workflow, and orchestrator runs.

### Packages
`packages/task-parser/` is a standalone ESM package that parses task blocks from markdown. Used by the orchestrator to extract and track delegated tasks from spec drafts.

## Project Structure
- `src/main/`, `src/preload/`, `src/shared/`: Electron main-process, preload bridge, shared state/contracts.
- `src/main.tsx` and feature folders (`src/space/`, `src/notes/`, `src/features/spec-panel/`, `src/git/`): renderer UI and domain logic.
- `packages/task-parser/src/`: reusable parser package (ESM), tests in `packages/task-parser/test/`.
- `scripts/`: local dev helpers; `dist/`: generated build output.

## Coding Style & Naming Conventions
- TypeScript/TSX throughout (plus small ESM JS utilities under `packages/task-parser` and `scripts`).
- 2-space indentation, semicolons, double quotes.
- `PascalCase` for React components/types, `camelCase` for functions/variables, `kebab-case` for filenames (e.g., `create-space-flow.tsx`).
- Colocate tests with the feature they validate.

## Testing Guidelines
- Vitest with `jsdom` environment and Testing Library (`src/test/setup.ts`).
- Prefer behavior-driven test names and user-visible assertions for UI flows.
- When changing shared logic (`src/git/*` or `packages/task-parser/*`), add/adjust tests in both impacted areas.
- Coverage thresholds: 80% statements/functions/lines, 70% branches (enforced by `vitest.config.ts`).
- Main process and preload code (`src/main/**`, `src/preload/**`) are excluded from coverage.

### UAT to E2E Policy
- Every UAT session must be followed by codifying the exercised behavior as Playwright end-to-end coverage.
- For each manual UAT scenario that passes or finds a regression, add/update a Playwright scenario that reproduces the same flow and expected result.
- UAT scenarios are a subset of the unified E2E suite, not a separate permanent test system.
- Keep naming split by intent:
  - `e2e:electron:smoke`: fast baseline gate.
  - `e2e:electron:uat`: newly codified/expanded scenarios from recent UAT.
  - `e2e`: umbrella command for all Electron E2E coverage.
- CI policy:
  - Pull requests run `e2e:electron:smoke`.
  - `main` pushes and nightly schedule run full `e2e`.
- Prefer shipping the Playwright coverage in the same PR as the fix; if scope is too large, open a follow-up task/issue before merge and link it in the PR.
- Keep Playwright artifacts in `output/playwright/` when screenshots are needed for debugging or PR evidence.
- Use repo-relative paths and commands in agent prompts/instructions; do not hard-code machine-specific absolute worktree paths.

## TypeScript Configuration
- `tsconfig.main.json`: CommonJS, Node/Electron types, outputs to `dist/`.
- `tsconfig.renderer.json`: ESNext/Bundler, DOM + Vite types, noEmit (Vite handles bundling).
- Both extend `tsconfig.base.json` for shared strict settings.

## Commit & Pull Request Guidelines
- Concise imperative commits with optional prefixes (`feat:`, `fix:`, `chore:`).
- PRs: short purpose statement, linked issue (if available), validation steps run, screenshots for UI updates.
- Keep PRs scoped; list follow-up work explicitly when deferring.

## Key Files for Orientation
Start here when joining the project:
- `src/shared/state.ts` — AppState contract and normalization
- `src/shared/shell-api.ts` — IPC channel definitions and ShellApi interface
- `src/preload/index.ts` — kataShell bridge implementation
- `src/main/index.ts` — main process entry, IPC handler registration
- `src/main.tsx` — renderer app root

## Project Management & Task Tracking

### Specification & Task Tracking
Location: `notes/`
- Tasks tracked as markdown files with structured format (see `notes/spec.md` for template).
- Each task includes: title, scope, inputs, definition of done, verification steps, and completion record.

### Product Management & Design
Location: `docs/`
- Product overview: `docs/kata-cloud-ovweview.md`
- PRD: `docs/PRD.md`
- Research: `docs/research.md`
