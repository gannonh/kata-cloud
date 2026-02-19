# Phase 7: Resume Integrity and Context Consistency - Research

**Researched:** 2026-02-19
**Domain:** Orchestrator session resume safety, interrupted-run recovery, context grounding consistency, and source provenance surfacing across the Electron main/preload/renderer boundary
**Confidence:** HIGH

## Summary

Phase 7 closes five requirements (CTX-03, CTX-04, SESS-01, SESS-02, SESS-03) that govern what happens when a user restarts the app or runs orchestration multiple times inside one session.

The persistence layer is already strong: `PersistedStateStore` reads/writes `~/.config/kata-cloud/kata-cloud-state.json` atomically on each `saveState` call, and `normalizeAppState` validates every field before loading. Phase 6 extended the run record schema with `contextRetrievalError` and shored up partial-payload recovery so that optional nested segments (context snippets, delegated tasks, draft) do not drop an otherwise-valid run.

Three gaps remain that block Phase 7 requirements:

**Gap 1 (SESS-01, SESS-02, SESS-03): No interrupted-run recovery.** The app saves a run as `"running"` before context retrieval starts (line 913, `src/main.tsx`). If Electron exits while a run is in-flight, the state file contains a record with `status: "running"` and no `completedAt`. On the next startup, `normalizeAppState` admits this record verbatim because `"running"` is a legal status. The user sees a perpetually-running run with no way to distinguish it from an active in-flight run. There is no staleness detection, no interrupted-run marker, and no UI distinction between an interrupted artifact and a live run.

**Gap 2 (CTX-03): No context grounding consistency guarantee across repeated session runs.** The context provider resolution chain (`resolveContextProviderId` in `src/context/context-adapter.ts`) correctly resolves session > space > filesystem precedence, but nothing asserts or records which provider was actually used per run. If a user changes the space or session provider between runs, each run may have retrieved context from a different provider with no structural tie between the request inputs and the stored snippets. The snippet objects carry a `provider` field, but the run record does not store the resolved provider at the time of retrieval.

**Gap 3 (CTX-04): Context source provenance is incomplete in the view model.** The `OrchestratorRunViewModel` exposes `contextPreview` (a plain text string from the first snippet) and `contextDiagnostics` (the failure error). It does not expose the resolved provider identity used for the successful retrieval, the snippet count, or a fallback-provider indicator (`fallbackFromProviderId` from `ContextRetrievalResult`). Users cannot tell which data source informed the output without inspecting run records directly.

**Primary recommendation:** Implement three focused changes in shared/state/main layers: (1) an interrupted-run recovery step at startup that transitions `"running"` or `"queued"` runs to a terminal `"interrupted"` status, (2) a per-run `resolvedProviderId` field that records the provider identity used for context retrieval, and (3) a view model provenance field that surfaces provider, snippet count, and fallback indicator in the UI.

## Current Baseline

### What is already solid

- `PersistedStateStore` reads, validates, and writes state safely on each save.
- `normalizeAppState` uses strict run timeline validation and recovers partial optional payloads without dropping entire records.
- `OrchestratorRunRecord` stores `contextRetrievalError`, `contextSnippets`, `delegatedTasks`, and `draft` with typed normalization guards.
- `completeOrchestratorRun` / `applyOrchestratorRunUpdate` / `enqueueOrchestratorRun` helpers centralize immutable run mutations.
- The Electron `did-finish-load` event re-pushes persisted state to the renderer, so history is visible immediately after restart.
- The Phase 6 UAT confirmed (test 4): "Restarting Electron preserves both the latest successful run and the earlier MCP diagnostic run."

### What is missing for Phase 7

| Requirement | Missing piece |
|-------------|---------------|
| SESS-01 | Verified by Phase 6 for completed/failed runs. Interrupted (`"running"`) runs load without recovery — they appear stuck. |
| SESS-02 | `activeSpaceId` and `activeSessionId` survive restart via `normalizeAppState`. But a run that was `"running"` at exit is restored with no link to what step it had reached, breaking user's ability to continue the workflow meaningfully. |
| SESS-03 | No staleness marker, no interrupted status, no UI distinction between an interrupted artifact and a live or historical run. |
| CTX-03 | Provider resolution is consistent in code, but nothing enforces or records the actual provider used. A run can be silently re-grounded on a different provider if space/session config changes. |
| CTX-04 | `contextPreview` surfaces one snippet path + content. No count, no resolved provider label, no fallback indicator in the view model. |

## Architecture Patterns

### Pattern 1: Interrupted-run recovery at startup (SESS-01, SESS-02, SESS-03)

Add a new orchestrator run status `"interrupted"` to represent a run that was in-flight when the app exited. At startup, after `PersistedStateStore.initialize()` completes, scan loaded runs for any with status `"queued"` or `"running"`. Transition each to `"interrupted"` and save back before broadcasting state to renderer.

This is a single responsibility belonging in the main process startup sequence. It requires:

1. Adding `"interrupted"` to `OrchestratorRunStatus` type and all guards/helpers in `src/shared/state.ts`.
2. Updating `ALLOWED_RUN_TRANSITIONS` in `src/shared/orchestrator-run-lifecycle.ts` to allow `running -> interrupted` and `queued -> interrupted`.
3. Adding an `interruptedAt` optional field to `OrchestratorRunRecord` (mirrors `completedAt` semantics).
4. Adding a startup recovery function in `src/main/persisted-state-store.ts` that scans for non-terminal runs and transitions them.
5. Updating `toStatusLabel` in `src/shared/orchestrator-run-view-model.ts` to label interrupted runs distinctly.
6. Updating the normalization guard `normalizeOrchestratorRunRecord` to accept `"interrupted"` status and the `interruptedAt` field.

This keeps recovery in the main process startup path where it belongs — not in the renderer.

**Example recovery logic (main process, called after initialize):**

```typescript
// src/main/persisted-state-store.ts
private async recoverInterruptedRuns(): Promise<void> {
  const now = new Date().toISOString();
  const runs = this.state.orchestratorRuns;
  const hasInterrupted = runs.some(
    (run) => run.status === "queued" || run.status === "running"
  );
  if (!hasInterrupted) return;
  const recovered = runs.map((run) =>
    run.status === "queued" || run.status === "running"
      ? { ...run, status: "interrupted" as const, interruptedAt: now, updatedAt: now }
      : run
  );
  this.state = { ...this.state, orchestratorRuns: recovered };
  await this.writeToDisk(this.state);
}
```

Call order in `initialize()`: `readFromDisk()` -> `recoverInterruptedRuns()` -> return state.

### Pattern 2: Resolved provider persistence per run (CTX-03)

Add `resolvedProviderId: ContextProviderId` to `OrchestratorRunRecord`. Capture this at the moment context retrieval is invoked inside `onRunOrchestrator` in `src/main.tsx`:

```typescript
const contextProviderId = resolveContextProviderId(
  activeSpace.contextProvider,
  activeSession.contextProvider
);
// store as resolvedProviderId on the enqueued run record
```

This gives every run a permanent record of which provider was active at retrieval time. If the space or session provider changes between runs, each run's `resolvedProviderId` reflects the actual provider used, making context grounding stable and inspectable.

Required changes:
- Add `resolvedProviderId?: ContextProviderId` to `OrchestratorRunRecord` in `src/shared/state.ts`.
- Update normalization guard to preserve or drop this field.
- Capture and persist from `onRunOrchestrator` in `src/main.tsx`.
- Include in view model provenance section.

### Pattern 3: Provenance projection in view model (CTX-04)

Extend `OrchestratorRunViewModel` with a `contextProvenance` object:

```typescript
export interface OrchestratorRunContextProvenance {
  resolvedProviderId: ContextProviderId;
  snippetCount: number;
  fallbackFromProviderId?: ContextProviderId;
}
```

Source data for this projection:
- `run.resolvedProviderId` (new field from Pattern 2)
- `run.contextSnippets?.length ?? 0`
- `run.contextSnippets?.[0]?.provider` (can differ from `resolvedProviderId` if fallback occurred; surface when different)

This is a pure view-model projection change in `src/shared/orchestrator-run-view-model.ts`, with a corresponding renderer UI update in `src/main.tsx`.

### Pattern 4: Status label and UI distinction for interrupted runs (SESS-03)

The renderer currently displays `Run {id} is {statusLabel}`. For interrupted runs, the label must communicate that the run did not complete normally. Recommend:

- `statusLabel: "Interrupted"` for `"interrupted"` status
- UI renders interrupted runs in history with a visually distinct class or label (e.g., `field-error` styling or an "Interrupted (app exited)" annotation)
- The "Status" info card for the latest run should read: "Run {id} was interrupted." not "Run {id} is Running."

This is a renderer-only change after the view model label is added.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Status transition for interrupted | Custom boolean `wasInterrupted` flag | Extend existing `OrchestratorRunStatus` union and `ALLOWED_RUN_TRANSITIONS` | Keeps lifecycle validation centralized and consistent |
| Startup scan for interrupted runs | Complex diffing or separate state file | Single pass in `PersistedStateStore.initialize()` before broadcasting state | One callsite, no race conditions |
| Provenance display | Separate IPC call or runtime lookup | Field on the persisted run record | Provenance must survive restart; it is historical data |
| Context grounding "re-verification" | Re-running context retrieval on load | Persisted `resolvedProviderId` field | Re-running changes state; only record what was used |

## Common Pitfalls

### Pitfall 1: Transitioning "running" to "interrupted" in renderer instead of main process

**What goes wrong:** If the renderer detects `"running"` runs on load and tries to transition them via `persistState`, there is a race between the renderer hydration effect and the main process startup. The main process must own this transition before it broadcasts state.

**How to avoid:** Recovery must happen in `PersistedStateStore.initialize()` before `broadcastState` is called. The renderer only ever sees already-recovered state.

### Pitfall 2: Forgetting "queued" status in the interrupted recovery scan

**What goes wrong:** A run can be persisted in `"queued"` status if the app exits after the initial `enqueueOrchestratorRun` save but before the `"running"` transition. A scan that only checks `"running"` will miss these.

**How to avoid:** Recovery must handle `status === "queued" || status === "running"`.

### Pitfall 3: Adding "interrupted" to status type breaks existing lifecycle validation

**What goes wrong:** `hasValidRunTimeline` in `src/shared/state.ts` enforces that every timeline entry is a valid `OrchestratorRunStatus`. Adding `"interrupted"` to the status union without adding it to the `isOrchestratorRunStatus` type guard and `isOrchestratorTaskStatus` equivalent will cause normalized state to drop interrupted runs.

**How to avoid:** After adding `"interrupted"` to the type, update all type guards and the `hasValidRunTimeline` logic. Add a `normalizeAppState` test that verifies interrupted runs survive round-trip.

### Pitfall 4: "interrupted" run timeline not starting from "queued"

**What goes wrong:** `hasValidRunTimeline` requires the first entry to be `"queued"`. An interrupted run may have a timeline of `["queued"]` (exit before running) or `["queued", "running"]` (exit during running). The recovery adds `"interrupted"` to the timeline. The validator must allow `running -> interrupted` and `queued -> interrupted` as valid transitions.

**How to avoid:** Update `ALLOWED_RUN_TRANSITIONS` in `src/shared/orchestrator-run-lifecycle.ts`:

```typescript
export const ALLOWED_RUN_TRANSITIONS: Record<OrchestratorRunStatus, readonly OrchestratorRunStatus[]> = {
  queued: ["running", "interrupted"],
  running: ["completed", "failed", "interrupted"],
  completed: [],
  failed: [],
  interrupted: []
};
```

### Pitfall 5: completedAt missing for interrupted runs breaks normalization

**What goes wrong:** `normalizeOrchestratorRunRecord` currently requires `completedAt` for terminal statuses. If `"interrupted"` is terminal but uses `interruptedAt` instead, the guard must be updated or interrupted runs will be dropped on reload.

**How to avoid:** Either reuse `completedAt` for interrupted runs (simplest) or add `interruptedAt` as an optional field alongside `completedAt` and update the guard to require `completedAt || interruptedAt` for terminal-or-interrupted statuses. Recommend reusing `completedAt` to minimize schema surface.

### Pitfall 6: Missing resolvedProviderId causes provenance projection to silently degrade

**What goes wrong:** Older persisted run records do not have `resolvedProviderId`. The view model projection must handle `undefined` gracefully rather than showing an empty or broken provenance section.

**How to avoid:** Make `contextProvenance` optional in `OrchestratorRunViewModel`. Only project when `resolvedProviderId` is present.

## Code Examples

### Interrupted-run recovery (main process)

```typescript
// Source: project codebase analysis — src/main/persisted-state-store.ts
async initialize(): Promise<AppState> {
  this.state = await this.readFromDisk();
  await this.recoverInterruptedRuns();
  return this.state;
}

private async recoverInterruptedRuns(): Promise<void> {
  const now = new Date().toISOString();
  const hasInterrupted = this.state.orchestratorRuns.some(
    (run) => run.status === "queued" || run.status === "running"
  );
  if (!hasInterrupted) return;
  const recovered = this.state.orchestratorRuns.map((run) =>
    run.status === "queued" || run.status === "running"
      ? {
          ...run,
          status: "interrupted" as const,
          completedAt: now,
          updatedAt: now,
          statusTimeline: [...run.statusTimeline, "interrupted"]
        }
      : run
  );
  this.state = { ...this.state, orchestratorRuns: recovered };
  await this.writeToDisk(this.state);
}
```

### Provenance projection in view model

```typescript
// Source: project codebase analysis — src/shared/orchestrator-run-view-model.ts
export interface OrchestratorRunContextProvenance {
  resolvedProviderId: string;
  snippetCount: number;
  fallbackFromProviderId?: string;
}

// In projectOrchestratorRunViewModel:
const contextProvenance: OrchestratorRunContextProvenance | undefined =
  run.resolvedProviderId
    ? {
        resolvedProviderId: run.resolvedProviderId,
        snippetCount: run.contextSnippets?.length ?? 0,
        fallbackFromProviderId: run.contextSnippets?.[0]?.provider !== run.resolvedProviderId
          ? run.contextSnippets?.[0]?.provider
          : undefined
      }
    : undefined;
```

### Status type extension

```typescript
// Source: project codebase analysis — src/shared/state.ts
export type OrchestratorRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";
```

## Candidate File Targets

### Shared contract changes
- `src/shared/state.ts` — add `"interrupted"` to status type, add `interruptedAt?` or align `completedAt` semantics, add `resolvedProviderId?` to run record, update guards
- `src/shared/orchestrator-run-lifecycle.ts` — add `"interrupted"` to `ALLOWED_RUN_TRANSITIONS`
- `src/shared/orchestrator-run-view-model.ts` — add `contextProvenance` field, add `"Interrupted"` status label
- `src/shared/state.test.ts` — add interrupted-run round-trip tests
- `src/shared/orchestrator-run-lifecycle.test.ts` — add interrupted transition tests
- `src/shared/orchestrator-run-view-model.test.ts` — add provenance projection tests

### Main process changes
- `src/main/persisted-state-store.ts` — add `recoverInterruptedRuns()` call in `initialize()`

### Renderer changes
- `src/main.tsx` — capture `resolvedProviderId` on run create/enqueue, render provenance section in latest-run and run history, render interrupted status distinctly

### E2E coverage
- `bin/playwright-electron-runner.mjs` — add `"session-resume-integrity-uat"` scenario (start run, kill app, restart, assert interrupted status visible), add `"context-provenance-uat"` scenario (assert provider label in run UI)

## Open Questions

1. **Reuse `completedAt` for interrupted runs, or add `interruptedAt`?**
   - What we know: `normalizeOrchestratorRunRecord` requires `completedAt` for terminal statuses. `interruptedAt` makes intent explicit but requires guard and type changes.
   - Recommendation: reuse `completedAt` populated with the recovery timestamp. It reduces schema surface and avoids multiple optional timestamp fields for terminal semantics. Document in code comment that for `"interrupted"` status, `completedAt` means "time of detected interruption."

2. **Should interrupted runs be retryable from the UI?**
   - What we know: SESS-02 says the user can continue a workflow after restart. But the run itself cannot be resumed mid-execution (the provider call is gone).
   - Recommendation: do not implement retry in Phase 7. Show the interrupted run in history with a clear label. The user can submit a new prompt to start a fresh run. Mark as a deferred improvement.

3. **Does `resolvedProviderId` belong on the enqueued run or on completion?**
   - What we know: the provider is resolved before context retrieval begins. It is available at enqueue time (within `onRunOrchestrator` before the retrieval call).
   - Recommendation: persist `resolvedProviderId` when the run transitions to `"running"`. It is known at that point and must not change after.

## Sources

### Primary (HIGH confidence)
- `src/shared/state.ts` — AppState schema, `normalizeOrchestratorRunRecord`, `hasValidRunTimeline`, guards
- `src/shared/orchestrator-run-lifecycle.ts` — `ALLOWED_RUN_TRANSITIONS`, `transitionOrchestratorRunStatus`
- `src/shared/orchestrator-run-view-model.ts` — `OrchestratorRunViewModel`, `projectOrchestratorRunViewModel`
- `src/shared/orchestrator-run-persistence.ts` — `enqueueOrchestratorRun`, `completeOrchestratorRun`
- `src/shared/orchestrator-run-history.ts` — session-scoped run filtering and sorting
- `src/main/persisted-state-store.ts` — disk read/write/normalize lifecycle
- `src/main/index.ts` — startup bootstrap, `did-finish-load` state broadcast
- `src/main.tsx` — `onRunOrchestrator` flow, context provider resolution, run persistence
- `src/context/context-adapter.ts` — `resolveContextProviderId`, fallback provider logic
- `src/context/types.ts` — `ContextRetrievalResult`, `fallbackFromProviderId`
- `.planning/phases/completed/06-delegation-context-contract-hardening/06-VERIFICATION.md`
- `.planning/phases/completed/06-delegation-context-contract-hardening/06-UAT.md`
- `bin/playwright-electron-runner.mjs` — existing UAT scenarios and relaunch pattern
- `.planning/REQUIREMENTS.md` — CTX-03, CTX-04, SESS-01, SESS-02, SESS-03 definitions

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md` — known tech debt and fragile areas
- `.planning/codebase/ARCHITECTURE.md` — layer responsibilities and data flow

## Metadata

**Confidence breakdown:**
- Interrupted-run gap: HIGH — confirmed by reading `normalizeAppState`, `PersistedStateStore.initialize`, and the run status union; no recovery code exists
- Recovery implementation pattern: HIGH — follows existing startup sequence and immutable run update helpers already in place
- Context provenance gap: HIGH — confirmed by reading `OrchestratorRunViewModel` and `onRunOrchestrator`; no `resolvedProviderId` field exists
- Provenance implementation pattern: HIGH — standard view model projection, consistent with Phase 6 `contextDiagnostics` pattern
- Phase scope fit: HIGH — all five requirements map to exactly three implementation surfaces (state schema, persisted-state-store startup, view model + renderer)

**Research date:** 2026-02-19
**Valid until:** 2026-03-20
