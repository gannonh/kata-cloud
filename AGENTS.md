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
- `pnpm run e2e:electron:uat`: run UAT verification Electron Playwright scenarios codified from manual UAT.
- `pnpm run e2e:electron:full`: run full Electron Playwright coverage (includes smoke + uat scenario tags).
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

## UAT Process

When the `kata-verify-work` skill is run, execute UAT in this order:

1. Resolve phase context and input artifacts:
   - Identify target phase from `.planning/STATE.md` / `.planning/ROADMAP.md`.
   - Read phase `*-SUMMARY.md` files to derive user-observable checks.
2. Run verification with Playwright for Electron flows:
   - Use `pnpm run e2e:electron:uat` for the UAT-tagged suite.
   - If needed, run targeted scenario development in `bin/playwright-electron-runner.mjs`.
3. Record UAT evidence in phase tracking:
   - Create or update `{phase}-UAT.md` under `.planning/phases/{state}/{phase-name}/`.
   - Track expected behavior, pass/fail outcome, summary counts, and gaps.
4. Codify UAT outcomes into automated E2E coverage:
   - Add or update scenario coverage in `bin/playwright-electron-runner.mjs`.
   - Update `docs/e2e-electron-matrix.md` so suite membership is explicit.
5. Re-run quality gates after coverage updates:
   - `pnpm run e2e:electron:uat`
   - `pnpm run desktop:typecheck`
6. Keep policy constraints:
   - UAT scenarios are part of the unified Electron E2E suite, not a separate permanent test system.
   - Naming split remains:
     - `e2e:electron:smoke`: fast baseline gate.
     - `e2e:electron:uat`: automated UAT verification scenarios.
     - `e2e:electron:full`: all Electron E2E coverage (smoke + uat + additional scenarios).
     - `e2e`: umbrella alias to full Electron E2E coverage.
   - CI policy:
     - Pull requests run `e2e:electron:smoke`.
     - `main` pushes and nightly schedule run full `e2e`.
   - Prefer shipping Playwright coverage in the same PR as the verified change.
   - Keep Playwright artifacts in `output/playwright/` for debugging/PR evidence.
   - Use repo-relative paths/commands in prompts and instructions.

### TypeScript Configuration
- `tsconfig.main.json`: CommonJS, Node/Electron types, outputs to `dist/`.
- `tsconfig.renderer.json`: ESNext/Bundler, DOM + Vite types, noEmit (Vite handles bundling).
- Both extend `tsconfig.base.json` for shared strict settings.

### Commit & Pull Request Guidelines
- Concise imperative commits with optional prefixes (`feat:`, `fix:`, `chore:`).
- PRs: short purpose statement, linked issue (if available), validation steps run, screenshots for UI updates.
- Keep PRs scoped; list follow-up work explicitly when deferring.

### Key Files for Orientation
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


## Skill Resource Resolution (Non-Negotiable)

When a `<skill>` is active, all skill-internal paths are resolved **RELATIVE TO THE INVOKED SKILL DIRECTORY, NOT THE PROJECT ROOT.**

- `SKILL_PATH` = absolute path to invoked `SKILL.md`
- `SKILL_BASE_DIR` = `dirname(SKILL_PATH)`

### Mandatory path resolution
Treat these as `SKILL_BASE_DIR`-relative unless the skill explicitly says “project root”:

- `./scripts/...`
- `scripts/...`
- `references/...`
- `assets/...`
- `templates/...`
- any other relative subfolder path shown in `SKILL.md`

### Forbidden during skill execution
Do **not** run project-root script paths for skill internals:

- `node scripts/...`
- `python3 scripts/...`
- `bash scripts/...`

This is forbidden unless the skill explicitly requires a project-root path.

### Lookup roots (only to find installed skills)
1. `/Users/gannonhall/.agents/skills/`
2. `/Users/gannonhall/.codex/skills/`

Once the skill is found, use only that skill’s directory for its internal resources.

### Pre-execution guard
Before running any command containing `scripts/`, verify it points to `${SKILL_BASE_DIR}/scripts/...` (or an absolute path inside `SKILL_BASE_DIR`).  
If not, stop and correct the command before execution.

### Example
If invoked skill is `/Users/gannonhall/.agents/skills/kata-plan-phase/SKILL.md`, then:
- `scripts/kata-lib.cjs` means  
`/Users/gannonhall/.agents/skills/kata-plan-phase/scripts/kata-lib.cjs`  
- never `./scripts/kata-lib.cjs` from repo root.
