# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Repository Guidelines

## Project Structure & Module Organization
`kata-cloud` is a pnpm workspace centered on a desktop app shell plus renderer features.

- `src/main`, `src/preload`, `src/shared`: Electron main-process, preload bridge, and shared state/contracts.
- `src/main.tsx`, `src/styles.css`, and feature folders (`src/space`, `src/notes`, `src/features/spec-panel`, `src/git`): renderer UI and domain logic.
- Tests are mostly colocated as `*.test.ts` / `*.test.tsx`; Node-only cases use `*.node.test.ts`.
- `packages/task-parser/src` contains the reusable parser package (ESM), with tests in `packages/task-parser/test`.
- `scripts/` holds local dev helpers; `dist/` is generated build output.

## Electron Architecture
The app uses Electron's security best practices:
- Main process (CommonJS) handles IPC, file system, and git operations via `src/main/index.ts`.
- Preload script exposes a typed `kataShell` API to the renderer via `contextBridge` (`src/preload/index.ts`).
- Renderer (ESNext/bundler) uses React 19 and communicates exclusively through `kataShell` API (never directly with Electron APIs).
- State is managed through a persistent store in main process and broadcast to all windows via IPC (`IPC_CHANNELS.stateChanged`).

## Build, Test, and Development Commands
- `pnpm install`: install dependencies.
- `pnpm run dev`: build Electron main, start Vite, then launch Electron (orchestrated by `scripts/dev-desktop.mjs`).
  - Sets `KATA_CLOUD_RENDERER_URL` env var for main process to locate the dev server.
  - Waits for Vite to be ready before launching Electron.
- `pnpm run web:dev`: run renderer only (Vite dev server on port 5173).
- `pnpm run build`: compile main process and bundle renderer assets.
- `pnpm run desktop:typecheck`: strict TS type checks for main + renderer configs.
- `pnpm run lint`: lint all files with ESLint (flat config in `eslint.config.mjs`).
- `pnpm test`: run Vitest once.
- `pnpm run test:watch`: run Vitest in watch mode.
- `pnpm test -- <pattern>`: run tests matching a file pattern (e.g., `pnpm test -- state`).
- `pnpm test -- -t "test name pattern"`: run tests matching a test name.

## Coding Style & Naming Conventions
- Language stack: TypeScript/TSX (plus small ESM JS utilities under `packages/task-parser` and `scripts`).
- Follow existing formatting patterns: 2-space indentation, semicolons, and double quotes.
- Naming: `PascalCase` for React components/types, `camelCase` for functions/variables, `kebab-case` for filenames (example: `create-space-flow.tsx`).
- Keep modules focused and colocate tests with the feature they validate.

## Testing Guidelines
- Test framework: Vitest with `jsdom` (`vitest.config.ts`) and Testing Library setup in `src/test/setup.ts`.
- Prefer behavior-driven test names and user-visible assertions for UI flows.
- When changing shared logic (for example `src/git/*` or `packages/task-parser/*`), add/adjust tests in both impacted areas.
- Coverage thresholds: 80% statements/functions/lines, 70% branches (enforced by vitest.config.ts).
- Main process and preload code (`src/main/**`, `src/preload/**`) are excluded from coverage.
- Before opening a PR, run: `pnpm test && pnpm run desktop:typecheck`.

## Commit & Pull Request Guidelines
- Current history includes both conventional and ad-hoc messages; prefer concise imperative commits with optional prefixes (`feat:`, `fix:`, `chore:`).
- Avoid generic summaries like `Agent changes`.
- PRs should include a short purpose statement, linked issue (if available), validation steps run, and screenshots for UI updates.
- Keep PRs scoped; list follow-up work explicitly when deferring.

## TypeScript Configuration
- Main process: `tsconfig.main.json` - CommonJS, Node/Electron types, outputs to `dist/`.
- Renderer: `tsconfig.renderer.json` - ESNext/Bundler, DOM + Vite types, noEmit (Vite handles bundling).
- Both extend `tsconfig.base.json` for shared strict settings.
