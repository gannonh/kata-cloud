# Technology Stack

**Analysis Date:** 2026-02-18

## Languages

**Primary:**
- TypeScript (strict mode) - application code across `src/` including Electron main (`src/main/index.ts`), preload (`src/preload/index.ts`), and renderer (`src/main.tsx`)
- JavaScript (ESM/CJS mix) - automation scripts in `scripts/*.mjs` and parser package in `packages/task-parser/src/*.js`

**Secondary:**
- TSX - React UI in `src/main.tsx`, `src/space/create-space-flow.tsx`, `src/features/spec-panel/spec-note-panel.tsx`
- Markdown - requirements/spec tracking in `notes/*.md` and docs under `docs/`

## Runtime

**Environment:**
- Node.js 22 in CI workflows (`.github/workflows/ci-quality-gates.yml`)
- Electron 37 runtime for desktop shell (`package.json`, `src/main/index.ts`)

**Package Manager:**
- pnpm 10.6.2 (`package.json` `packageManager`)
- Lockfile present: `pnpm-lock.yaml`

## Frameworks

**Core:**
- Electron `^37.2.0` - desktop shell process boundaries (`src/main/index.ts`, `src/preload/index.ts`)
- React 19 - renderer UI (`src/main.tsx`)

**Testing:**
- Vitest `^3.0.5` with jsdom (`vitest.config.ts`)
- Testing Library (`@testing-library/react`, `@testing-library/user-event`) for UI behavior tests (`src/**/*.test.tsx`)
- Playwright Core for Electron end-to-end scripts (`scripts/playwright-electron-*.mjs`)

**Build/Dev:**
- TypeScript compiler (`tsc`) with split configs (`tsconfig.main.json`, `tsconfig.renderer.json`)
- Vite 6 for renderer dev/build (`package.json`, `scripts/dev-desktop.mjs`)
- ESLint 9 flat config (`eslint.config.mjs`)

## Key Dependencies

**Critical:**
- `electron` - process boundary and IPC infrastructure
- `react` / `react-dom` - renderer stateful UI
- `typescript` - strict typing across all domains

**Infrastructure:**
- `@typescript-eslint/*` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` - linting pipeline
- `vitest` + `@vitest/coverage-v8` - test runner + coverage thresholds
- `playwright-core` - scripted Electron flow validation

## Configuration

**Environment:**
- Dev renderer URL configured by `KATA_CLOUD_RENDERER_URL` (`scripts/dev-desktop.mjs`, `src/main/index.ts`)
- Electron sandbox toggles used by CI for Linux runtime (`KATA_CLOUD_ELECTRON_NO_SANDBOX` in `.github/workflows/*.yml`)

**Build:**
- Main process build: `pnpm run desktop:build-main` (`tsconfig.main.json` -> `dist/`)
- Renderer bundle: `vite build`
- Typecheck gate: `pnpm run desktop:typecheck`

## Platform Requirements

**Development:**
- Node + pnpm toolchain
- Desktop platform capable of running Electron

**Production:**
- Electron desktop target with packaged renderer (`src/main/index.ts` loads `dist/index.html` when packaged)

---

*Stack analysis: 2026-02-18*
