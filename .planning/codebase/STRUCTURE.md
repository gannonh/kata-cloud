# Codebase Structure

**Analysis Date:** 2026-02-18

## Directory Layout

```
kata-cloud/
├── src/                     # Electron app source (main, preload, renderer, domains)
├── packages/task-parser/    # Reusable parser package (ESM)
├── bin/                 # Dev/test/e2e orchestration scripts
├── notes/                   # Spec/task markdown artifacts
├── docs/                    # Product/PRD/research/design docs
├── .github/workflows/       # CI and automation workflows
└── dist/                    # Built output (generated)
```

## Directory Purposes

**`src/main/`:**
- Purpose: Electron main process runtime and provider integrations
- Contains: IPC registration, provider runtime registry/service, persisted state store
- Key files: `src/main/index.ts`, `src/main/persisted-state-store.ts`

**`src/preload/`:**
- Purpose: context-bridge shell API
- Contains: preload IPC channel constants + bridge implementation
- Key files: `src/preload/index.ts`

**`src/shared/`:**
- Purpose: cross-process contracts and domain helpers
- Contains: state contract/normalization, shell API interface/channels, orchestrator helpers
- Key files: `src/shared/state.ts`, `src/shared/shell-api.ts`

**`src/git/`:**
- Purpose: git lifecycle, status/diff parsing, PR workflow
- Contains: CLI wrappers, service classes, type guards/errors, diff UI helper components
- Key files: `src/git/space-git-service.ts`, `src/git/pr-workflow.ts`, `src/git/git-cli.ts`

**`src/features/spec-panel/`, `src/notes/`, `src/space/`:**
- Purpose: renderer domain modules for spec comments, notes, and space workflows
- Contains: types/validation/store/component files with colocated tests

**`packages/task-parser/`:**
- Purpose: parse task blocks from markdown for orchestrator use
- Contains: ESM source and test suite

## Key File Locations

**Entry Points:**
- `src/main/index.ts`: Electron main process startup
- `src/preload/index.ts`: preload bridge
- `src/main.tsx`: renderer app root

**Configuration:**
- `package.json`: bin/dependencies
- `eslint.config.mjs`: lint rules
- `vitest.config.ts`: test and coverage config
- `tsconfig.main.json`, `tsconfig.renderer.json`: build/typecheck splits

**Core Logic:**
- `src/shared/state.ts`: canonical `AppState`
- `src/git/*.ts`: git + PR capabilities
- `src/main/provider-runtime/*.ts`: provider runtime and errors

**Testing:**
- Co-located `*.test.ts`, `*.test.tsx`, and `*.node.test.ts`
- E2E command drivers in `bin/playwright-electron-smoke.mjs` and `bin/playwright-electron-e2e.mjs`

## Naming Conventions

**Files:**
- `kebab-case` for module files (for example `space-git-service.ts`)
- `PascalCase` component exports in TSX files
- `*.node.test.ts` suffix for node-only tests

**Directories:**
- Domain-oriented folders under `src/` (`git`, `space`, `notes`, `context`, `main/providers`)

## Where to Add New Code

**New renderer feature:**
- Primary code: `src/features/<feature-name>/`
- Tests: co-located `*.test.ts`/`*.test.tsx` in same feature folder

**Main-process capability:**
- Implementation: `src/main/` plus shared request/response types in `src/shared/` or domain `types.ts`
- IPC channel wiring: `src/shared/shell-api.ts`, `src/main/index.ts`, `src/preload/index.ts`

**Git/domain service extensions:**
- Implementation: `src/git/`
- Tests: `src/git/*.test.ts` and `src/git/*.node.test.ts` as needed

**Reusable parser logic:**
- Implementation: `packages/task-parser/src/`
- Tests: `packages/task-parser/test/`

## Special Directories

**`dist/`:**
- Purpose: compiled main process + bundled renderer assets
- Generated: Yes
- Committed: No

**`output/playwright/`:**
- Purpose: E2E artifacts/screenshots
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-02-18*
