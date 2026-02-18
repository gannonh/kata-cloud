# Coding Conventions

**Analysis Date:** 2026-02-18

## Naming Patterns

**Files:**
- `kebab-case` modules such as `src/git/space-git-service.ts`
- React component modules keep `kebab-case` filenames with PascalCase exports (`src/space/create-space-flow.tsx` exports `CreateSpaceFlow`)
- Test suffixes: `*.test.ts`, `*.test.tsx`, and `*.node.test.ts`

**Functions:**
- `camelCase` for functions/utilities (`normalizeAppState`, `createMainWindow`, `parseGitStatusPorcelain`)

**Variables:**
- `camelCase` locals and state variables in renderer/main modules
- `UPPER_SNAKE_CASE` for constants (`APP_STATE_VERSION`, `DEFAULT_MAX_TOKENS`)

**Types:**
- `PascalCase` interfaces/types (`SpaceRecord`, `ProviderExecuteIpcRequest`)
- union literals for finite domain states (`"queued" | "running" | ...`)

## Code Style

**Formatting:**
- 2-space indentation, semicolons, double quotes (project policy in `AGENTS.md`)
- TypeScript strict mode in `tsconfig.base.json`

**Linting:**
- ESLint flat config (`eslint.config.mjs`)
- `@typescript-eslint/no-unused-vars` enforced with `_` arg exemption
- React hooks rules enabled (`eslint-plugin-react-hooks`)

## Import Organization

**Order:**
1. Runtime/framework imports (`react`, `electron`, `node:*`)
2. Project-relative imports (domain/shared modules)
3. Type-only imports grouped with `type` keyword where useful

**Path Aliases:**
- Not detected; relative imports are used (`./`, `../`)

## Error Handling

**Patterns:**
- Main/service layers throw typed domain errors with `code` + remediation (`src/git/space-git-errors.ts`, `src/main/provider-runtime/errors.ts`)
- Renderer transforms unknown errors to display-safe text via helper (`toErrorMessage` in `src/main.tsx`)
- Fallback strategies for malformed persisted/local state (`normalizeAppState`, localStorage guards)

## Logging

**Framework:** console logging

**Patterns:**
- `console.error` for failing side effects and provider/github workflows
- `console.warn` for rejected or suspicious requests (`src/main/index.ts` context root validation)

## Comments

**When to Comment:**
- Sparse comments for security/process-boundary constraints (for example preload IPC sync note in `src/preload/index.ts`)

**JSDoc/TSDoc:**
- Minimal; code favors descriptive type names and explicit function signatures over heavy docblocks

## Function Design

**Size:**
- Small/medium pure helpers in domain modules (`src/shared/*`, `src/git/changes.ts`)
- Large orchestration functions in `src/main.tsx` and service classes where workflows are stateful

**Parameters:**
- Request object types for IO boundaries (`SpaceGitLifecycleRequest`, `ProviderExecuteIpcRequest`)

**Return Values:**
- Typed result objects instead of loosely shaped maps
- Discriminated unions for success/failure in store helpers (`src/space/store.ts`)

## Module Design

**Exports:**
- Named exports preferred
- Module-level type exports colocated with implementation

**Barrel Files:**
- Selective barrels in some domains (`src/context/index.ts`, `src/features/spec-panel/index.ts`)

---

*Convention analysis: 2026-02-18*
