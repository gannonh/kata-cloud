# PR Review Fix-Up Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all remaining issues from the PR review of `feat/v0.1.0-05-orchestrator-lifecycle-determinism`.

**Architecture:** The critical issues (duplicate table, orphaned runs, redundant overrides) were already resolved in the working tree. Remaining work covers: unused `changed` field removal, test gaps, raw enum labels in display strings, and logging for all silent catch blocks.

**Tech Stack:** TypeScript, Vitest, React 19, Electron

---

## What is already fixed (do NOT redo)

- `state.ts` imports `ALLOWED_RUN_TRANSITIONS` from lifecycle — no duplicate table
- `main.tsx` recovery paths: both transition guard failures persist a `"failed"` run and return
- `runningRun` mapped directly (no redundant `updatedAt: runningAt` override)

---

## Remaining Issues (in order of execution)

### Task 1: Remove unused `changed` field from lifecycle types and implementation

`changed` is computed but never read at any call site. Its presence implies a write-skip contract that nothing honours.

**Files:**
- Modify: `src/shared/orchestrator-run-lifecycle.ts`
- Modify: `src/shared/orchestrator-run-lifecycle.test.ts`

**Step 1: Remove `changed` from the success interface and implementation**

In `src/shared/orchestrator-run-lifecycle.ts`, make these changes:

```typescript
// BEFORE
export interface OrchestratorRunTransitionSuccess {
  ok: true;
  changed: boolean;
  run: OrchestratorRunRecord;
}

export interface OrchestratorRunTransitionFailure {
  ok: false;
  changed: false;
  run: OrchestratorRunRecord;
  reason: string;
}
```

```typescript
// AFTER
export interface OrchestratorRunTransitionSuccess {
  ok: true;
  run: OrchestratorRunRecord;
}

export interface OrchestratorRunTransitionFailure {
  ok: false;
  run: OrchestratorRunRecord;
  reason: string;
}
```

Also remove the `changed:` property from both return statements in the idempotent branch (lines 48-62) and the forward transition branch (lines 75-86). The `changed` expression on line 50-54 is deleted entirely. The `changed: true` on line 77 is deleted.

**Step 2: Run tests to verify nothing breaks**

```bash
pnpm test -- orchestrator-run-lifecycle
```

Expected: 4 tests pass.

**Step 3: Commit**

```bash
git add src/shared/orchestrator-run-lifecycle.ts src/shared/orchestrator-run-lifecycle.test.ts
git commit -m "refactor: remove unused changed field from OrchestratorRunTransitionResult"
```

---

### Task 2: Add missing invalid-transition tests

Three invalid transition combinations are not covered: `queued -> failed`, `completed -> running`, `failed -> running`.

**Files:**
- Modify: `src/shared/orchestrator-run-lifecycle.test.ts`

**Step 1: Add three tests after the existing "rejects invalid lifecycle jumps" test**

```typescript
it("rejects queued -> failed (skips running)", () => {
  const queuedRun = createQueuedRun();
  const result = transitionOrchestratorRunStatus(queuedRun, "failed", "2026-02-18T00:00:01.000Z");

  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.reason).toContain("queued -> failed");
  expect(result.run.status).toBe("queued");
});

it("rejects completed -> running (re-queue attempt)", () => {
  const queuedRun = createQueuedRun();
  const running = transitionOrchestratorRunStatus(queuedRun, "running", "2026-02-18T00:00:01.000Z");
  if (!running.ok) return;
  const completed = transitionOrchestratorRunStatus(running.run, "completed", "2026-02-18T00:00:02.000Z");
  if (!completed.ok) return;

  const result = transitionOrchestratorRunStatus(completed.run, "running", "2026-02-18T00:00:03.000Z");

  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.reason).toContain("completed -> running");
  expect(result.run.status).toBe("completed");
});

it("rejects failed -> running (retry attempt)", () => {
  const queuedRun = createQueuedRun();
  const running = transitionOrchestratorRunStatus(queuedRun, "running", "2026-02-18T00:00:01.000Z");
  if (!running.ok) return;
  const failed = transitionOrchestratorRunStatus(running.run, "failed", "2026-02-18T00:00:02.000Z", "err");
  if (!failed.ok) return;

  const result = transitionOrchestratorRunStatus(failed.run, "running", "2026-02-18T00:00:03.000Z");

  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.reason).toContain("failed -> running");
  expect(result.run.status).toBe("failed");
});
```

**Step 2: Run tests to confirm they pass**

```bash
pnpm test -- orchestrator-run-lifecycle
```

Expected: 7 tests pass (4 original + 3 new).

**Step 3: Commit**

```bash
git add src/shared/orchestrator-run-lifecycle.test.ts
git commit -m "test: cover queued->failed, completed->running, failed->running rejections"
```

---

### Task 3: Add errorMessage-clearing test + fix idempotent timestamp

Two test quality gaps: errorMessage clearing on idempotent non-failed transition is untested; the idempotent test uses the same timestamp as the first transition (can't distinguish correct idempotency from coincidence).

**Files:**
- Modify: `src/shared/orchestrator-run-lifecycle.test.ts`

**Step 1: Fix the idempotent test to use a new timestamp**

In the existing "is idempotent for duplicate statuses" test, change the duplicate call's timestamp from `"2026-02-18T00:00:01.000Z"` to `"2026-02-18T00:00:02.000Z"` and add an assertion that `updatedAt` is updated:

```typescript
it("is idempotent for duplicate statuses", () => {
  const queuedRun = createQueuedRun();
  const first = transitionOrchestratorRunStatus(
    queuedRun,
    "running",
    "2026-02-18T00:00:01.000Z"
  );
  expect(first.ok).toBe(true);
  if (!first.ok) return;

  const duplicate = transitionOrchestratorRunStatus(
    first.run,
    "running",
    "2026-02-18T00:00:02.000Z"   // new timestamp
  );
  expect(duplicate.ok).toBe(true);
  if (!duplicate.ok) return;

  expect(duplicate.run.status).toBe("running");
  expect(duplicate.run.statusTimeline).toEqual(["queued", "running"]);
  expect(duplicate.run.updatedAt).toBe("2026-02-18T00:00:02.000Z");
});
```

**Step 2: Add errorMessage-clearing test**

Add this test after the idempotent test:

```typescript
it("clears stale errorMessage when idempotent non-failed transition occurs", () => {
  // Construct a run that somehow has errorMessage in running state
  // (simulating a corrupted persisted record)
  const runWithStaleError: OrchestratorRunRecord = {
    id: "run-1",
    spaceId: "space-1",
    sessionId: "session-1",
    prompt: "Build lifecycle primitives",
    status: "running",
    statusTimeline: ["queued", "running"],
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:01.000Z",
    errorMessage: "Stale error from previous attempt."
  };

  const result = transitionOrchestratorRunStatus(
    runWithStaleError,
    "running",
    "2026-02-18T00:00:02.000Z"
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.run.errorMessage).toBeUndefined();
  expect(result.run.updatedAt).toBe("2026-02-18T00:00:02.000Z");
});
```

**Step 3: Run tests**

```bash
pnpm test -- orchestrator-run-lifecycle
```

Expected: 9 tests pass.

**Step 4: Commit**

```bash
git add src/shared/orchestrator-run-lifecycle.test.ts
git commit -m "test: fix idempotent timestamp and cover errorMessage clearing"
```

---

### Task 4: Add task status label mapping to eliminate raw enum names from lifecycleText

`projectDelegatedTask` currently joins raw status identifiers ("queued", "delegating", etc.) directly into the display string. If a domain status is renamed, UI strings change with no type error.

**Files:**
- Modify: `src/shared/orchestrator-run-view-model.ts`
- Modify: `src/shared/orchestrator-run-view-model.test.ts`

**Step 1: Add `toTaskStatusLabel` and use it in `projectDelegatedTask`**

In `src/shared/orchestrator-run-view-model.ts`, add after `toStatusLabel`:

```typescript
function toTaskStatusLabel(status: OrchestratorTaskStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "delegating":
      return "Delegating";
    case "delegated":
      return "Delegated";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}
```

In `projectDelegatedTask`, change the `lifecycleText` line:

```typescript
// BEFORE
lifecycleText: task.statusTimeline.join(" -> "),

// AFTER
lifecycleText: task.statusTimeline.map(toTaskStatusLabel).join(" -> "),
```

**Step 2: Update the test expectation**

In `src/shared/orchestrator-run-view-model.test.ts`, the test "surfaces delegated failure diagnostics" at line 70:

```typescript
// BEFORE
expect(projection.delegatedTasks[1]?.lifecycleText).toBe("queued -> delegating -> failed");

// AFTER
expect(projection.delegatedTasks[1]?.lifecycleText).toBe("Queued -> Delegating -> Failed");
```

**Step 3: Run tests**

```bash
pnpm test -- orchestrator-run-view-model
```

Expected: all 5 tests pass.

**Step 4: Commit**

```bash
git add src/shared/orchestrator-run-view-model.ts src/shared/orchestrator-run-view-model.test.ts
git commit -m "refactor: map task status identifiers to display labels in lifecycleText"
```

---

### Task 5: Fix `toStatusLabel` default branch + use `statusLabel` in main.tsx display

The `toStatusLabel` switch has an unreachable `default` branch (TypeScript cannot enforce exhaustiveness with it present). Also, `main.tsx` line 1508 uses `latestRunViewModel.status` (the raw domain value) in a display string, but `statusLabel` is the right field for display.

**Files:**
- Modify: `src/shared/orchestrator-run-view-model.ts`
- Modify: `src/main.tsx`

**Step 1: Remove `default` branch from `toStatusLabel`**

```typescript
// BEFORE
function toStatusLabel(status: OrchestratorRunStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

// AFTER
function toStatusLabel(status: OrchestratorRunStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}
```

**Step 2: Use `statusLabel` in the main.tsx display string**

In `src/main.tsx` around line 1507-1509:

```typescript
// BEFORE
{latestRunViewModel
  ? `Run ${latestRunViewModel.id} is ${latestRunViewModel.status}.`
  : "No orchestrator runs yet."}

// AFTER
{latestRunViewModel
  ? `Run ${latestRunViewModel.id} is ${latestRunViewModel.statusLabel}.`
  : "No orchestrator runs yet."}
```

**Step 3: Add comment about dual condition + mixed record access at line 1511**

Above the `{latestRunViewModel && latestRunForActiveSession ? (` conditional, add a comment:

```typescript
{/* latestRunViewModel is derived from latestRunForActiveSession; both are null/non-null
    simultaneously. Draft fields (draft, draftAppliedAt, draftApplyError) are not projected
    into the view model, so the raw record is accessed for those fields only. */}
{latestRunViewModel && latestRunForActiveSession ? (
```

**Step 4: Run tests + typecheck**

```bash
pnpm test && pnpm run desktop:typecheck
```

Expected: all 187 tests pass, typecheck clean.

**Step 5: Commit**

```bash
git add src/shared/orchestrator-run-view-model.ts src/main.tsx
git commit -m "fix: use statusLabel for display, remove unreachable default branch"
```

---

### Task 6: Add logging to all silent catch blocks

Four pre-existing catch blocks either swallow errors entirely or fail to bind the error object. These produce invisible failures in Electron DevTools and development.

**Files:**
- Modify: `src/main.tsx`

**Locations and fixes:**

**`readLocalFallbackState` (line ~84):**
```typescript
// BEFORE
} catch {
  return createInitialAppState();
}

// AFTER
} catch (error) {
  console.warn("Failed to read local fallback state; starting fresh.", error);
  return createInitialAppState();
}
```

**`writeLocalFallbackState` (line ~92-94):**
```typescript
// BEFORE
} catch {
  // Keep runtime resilient when storage quota is unavailable.
}

// AFTER
} catch (error) {
  console.warn("Failed to write local fallback state.", error);
}
```

**`hydrate()` catch (line ~283-288):**
```typescript
// BEFORE
} catch {
  if (!cancelled) {
    setState(readLocalFallbackState());
    setIsBootstrapping(false);
  }
}

// AFTER
} catch (error) {
  console.error("Failed to load state from shell; falling back to local storage.", error);
  if (!cancelled) {
    setState(readLocalFallbackState());
    setIsBootstrapping(false);
  }
}
```

**`persistState` catch (line ~313-315):**
```typescript
// BEFORE
} catch {
  writeLocalFallbackState(normalized);
}

// AFTER
} catch (error) {
  console.error("Failed to persist state via shell; writing to local storage.", error);
  writeLocalFallbackState(normalized);
}
```

**Step 2: Run tests to confirm nothing breaks**

```bash
pnpm test
```

Expected: 187 tests pass (catch blocks are not unit-tested; this is a smoke check).

**Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "fix: add logging to all previously silent catch blocks"
```

---

### Task 7: Log when runs are dropped during normalization

`normalizeAppState` silently drops `OrchestratorRunRecord` entries that fail validation. A shrinking run history with no console trace is hard to debug.

**Files:**
- Modify: `src/shared/state.ts`

**Step 1: Change the filter to log dropped records**

In `normalizeAppState`, find the run filter (around line 352-355):

```typescript
// BEFORE
const orchestratorRuns = Array.isArray(input.orchestratorRuns)
  ? input.orchestratorRuns.filter(isOrchestratorRunRecord)
  : [];

// AFTER
const orchestratorRuns = Array.isArray(input.orchestratorRuns)
  ? input.orchestratorRuns.filter((entry) => {
      if (isOrchestratorRunRecord(entry)) {
        return true;
      }
      const id = isObject(entry) && isString((entry as Record<string, unknown>).id)
        ? (entry as Record<string, unknown>).id
        : "(unknown)";
      console.warn(`normalizeAppState: dropping invalid orchestrator run record (id=${id})`);
      return false;
    })
  : [];
```

**Step 2: Run tests**

```bash
pnpm test && pnpm run desktop:typecheck
```

Expected: all tests pass, typecheck clean.

**Step 3: Commit**

```bash
git add src/shared/state.ts
git commit -m "fix: log dropped orchestrator run records during state normalization"
```

---

## Final verification

After all tasks:

```bash
pnpm test && pnpm run desktop:typecheck
```

Both must pass clean before the PR is ready.
