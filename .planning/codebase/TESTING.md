# Testing Patterns

**Analysis Date:** 2026-02-18

## Test Framework

**Runner:**
- Vitest `^3.x`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest `expect` with Testing Library matchers from `@testing-library/jest-dom/vitest` (`src/test/setup.ts`)

**Run Commands:**
```bash
pnpm test                    # Run tests once
pnpm run test:watch          # Watch mode
pnpm run test -- --coverage  # Coverage report (v8 provider)
```

## Test File Organization

**Location:**
- Mostly co-located with source modules in `src/**`
- Package tests under `packages/task-parser/test/`

**Naming:**
- `*.test.ts` / `*.test.tsx` for standard tests
- `*.node.test.ts` for Node-only behavior

**Structure:**
```
src/<domain>/<module>.ts
src/<domain>/<module>.test.ts
src/<domain>/<module>.node.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe("parseGitStatusPorcelain", () => {
  it("parses staged, unstaged, untracked, and rename entries", () => {
    const changes = parseGitStatusPorcelain(output);
    expect(changes).toHaveLength(6);
  });
});
```

**Patterns:**
- Behavior-driven `describe`/`it` names
- Arrange/act/assert shape with explicit expectations
- Deterministic time/id injection for store logic (`src/features/spec-panel/store.test.ts`)

## Mocking

**Framework:**
- Vitest spies/mocks where needed in node tests

**Patterns:**
```typescript
const base = createDefaultSpecNote(() => "2026-02-16T00:00:00.000Z");
const withThread = addCommentThread(base, input, {
  now: () => "2026-02-16T00:00:01.000Z",
  makeId: () => "a"
});
```

**What to Mock:**
- Time/id generators, network clients, and process-boundary dependencies

**What NOT to Mock:**
- Pure parsing/validation functions and deterministic transformation helpers

## Fixtures and Factories

**Test Data:**
- Inline literal fixtures for input/output parsing checks (`src/git/changes.test.ts`)
- Builder/factory helpers for domain state (`createDefaultSpecNote` in `src/features/spec-panel/store.ts`)

**Location:**
- Usually local to each test file; no central fixtures directory detected

## Coverage

**Requirements:**
- Thresholds in `vitest.config.ts`: 80% statements/functions/lines, 70% branches

**View Coverage:**
```bash
pnpm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Dominant style across shared/domain modules (`src/shared/*.test.ts`, `src/git/*.test.ts`)

**Integration Tests:**
- Node-oriented service behavior tests (`src/main/provider-runtime/*.node.test.ts`, `src/git/space-git-service.node.test.ts`)

**E2E Tests:**
- Electron flow suites run via tagged Playwright runner (`bin/playwright-electron-runner.mjs`) with `smoke`, `uat`, and `full` suite selectors.

## Common Patterns

**Async Testing:**
```typescript
it("returns lifecycle status", async () => {
  const result = await service.initializeSpace(request);
  expect(result.phase).toBe("ready");
});
```

**Error Testing:**
```typescript
await expect(service.execute(request)).rejects.toMatchObject({
  code: "missing_auth"
});
```

---

*Testing analysis: 2026-02-18*
