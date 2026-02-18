# Phase 5: Orchestrator Lifecycle Determinism - Research

**Researched:** 2026-02-18
**Domain:** Orchestrator run lifecycle state transitions and delegated task status projection in Electron + React + shared TypeScript domain models
**Confidence:** HIGH

## Summary

Phase 5 should be implemented by strengthening deterministic lifecycle behavior in the existing shared-state layer, then projecting that data consistently in renderer UI. The codebase already has strong primitives (`OrchestratorRunRecord`, timeline arrays, deterministic failure trigger, delegation timeline builder), so the highest-leverage strategy is to add strict transition helpers and route all renderer flow updates through those helpers.

The standard approach in this repository is: shared domain modules in `src/shared/*` own deterministic state semantics, while `src/main.tsx` consumes those helpers and persists updates through `persistState`. This keeps logic testable and avoids burying lifecycle rules directly in UI handlers.

**Primary recommendation:** Add explicit run lifecycle transition helpers in `src/shared`, keep renderer updates thin, and gate completion with targeted shared tests plus orchestrator-focused regression checks.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
| ------- | ------- | ------- | ------------ |
| TypeScript | ^5.7.3 | Domain model safety and deterministic helper contracts | Existing shared-state modules rely on strict TS unions/guards |
| React | ^19.0.0 | Renderer orchestration flow and state updates | Existing orchestrator UI/runtime path is implemented in React hooks |
| Vitest | ^3.0.5 | Deterministic unit tests for shared orchestrator logic | Existing orchestrator/state modules already validated with Vitest suites |

### Supporting
| Library | Version | Purpose | When to Use |
| ------- | ------- | ------- | ----------- |
| Electron | ^37.2.0 | Desktop shell and preload bridge execution environment | Needed for end-to-end orchestration behavior in desktop app |
| Testing Library | ^16.x stack | Renderer behavior assertions (when UI-focused assertions are needed) | Use when adding UI-centric status rendering checks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
| ---------- | --------- | -------- |
| Shared transition helpers | Inline mutations in `src/main.tsx` | Faster initial edits but higher drift/regression risk and weaker testability |
| Existing status unions | Looser string statuses | Reduces upfront friction but weakens deterministic guards and normalization |

**Installation:**
```bash
# No new packages required for this phase baseline.
pnpm install
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── shared/                  # Deterministic run/task lifecycle rules and selectors
├── main.tsx                 # UI handler wiring that consumes shared helpers
└── preload/                 # Shell bridge (unchanged for this phase unless contract changes)
```

### Pattern 1: Shared lifecycle logic, thin UI handlers
**What:** Keep transition and timeline invariants in shared modules (`src/shared/*`) and call them from UI callbacks.
**When to use:** Any status mutation that can affect run history, delegated tasks, or persistence consistency.
**Example:**
```typescript
const runningRun = appendRunStatus(queuedRun, "running");
```
Source: local implementation in `src/main.tsx` + `src/shared/state.ts` contract.

### Pattern 2: Timeline-first observability
**What:** Persist status timeline arrays for both runs and delegated tasks and render them directly for diagnostics.
**When to use:** Any run-state update that must be auditable in UI and persisted state.
**Example:**
```typescript
statusTimeline: ["queued", "delegating", "delegated", "running", "completed"]
```
Source: `src/shared/orchestrator-delegation.ts` and existing orchestrator UI sections in `src/main.tsx`.

### Anti-Patterns to Avoid
- **Duplicated transition rules across files:** causes drift between run status and timeline semantics.
- **Terminal-state mutation without invariant checks:** can leave `status`, `statusTimeline`, and `completedAt` inconsistent.
- **UI-first lifecycle logic:** hard to test and easy to regress in the monolithic renderer component.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
| ------- | ----------- | ----------- | --- |
| Run/session filtering | Custom ad-hoc filtering in JSX loops | `getRunsForActiveSession` / `getRunHistoryForActiveSession` | Existing selectors already encode intended grouping and ordering behavior |
| Delegated task specialist mapping | Inline switch blocks in multiple places | `ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE` and `buildDelegatedTaskTimeline` | Centralized mapping avoids specialist-name drift |
| Failure keyword parsing duplication | Multiple regexes in renderer handlers | `resolveRunFailure` + `hasDeterministicFailureTrigger` | Single failure taxonomy source reduces divergent error text |

**Key insight:** The codebase already contains strong deterministic primitives; phase value comes from consolidating usage, not introducing new frameworks.

## Common Pitfalls

### Pitfall 1: Status and timeline divergence
**What goes wrong:** `status` changes but `statusTimeline` is missing terminal states.
**Why it happens:** Direct object mutation or bypassing helper functions.
**How to avoid:** Route updates through shared transition helpers and assert timeline invariants in tests.
**Warning signs:** Runs with terminal status but short/incomplete timelines in persisted state fixtures.

### Pitfall 2: Delegated task state masking run-level failures
**What goes wrong:** Task rows show completion while run-level failure messaging is ambiguous.
**Why it happens:** Run failure and task failure are rendered independently without shared projection rules.
**How to avoid:** Add a single run view-model/projection helper that merges run/task diagnostics.
**Warning signs:** UI shows mixed success/failure cues without actionable remediation text.

### Pitfall 3: Monolithic `main.tsx` edits causing accidental regressions
**What goes wrong:** Lifecycle changes break unrelated views or persistence behavior.
**Why it happens:** Large callback blocks updated without constrained helper boundaries.
**How to avoid:** Keep `main.tsx` changes as wiring-only, with most behavior in shared modules plus targeted tests.
**Warning signs:** Broad diffs in unrelated UI branches during orchestrator-specific work.

## Code Examples

Verified patterns from repository sources:

### Run status append pattern
```typescript
function appendRunStatus(run: OrchestratorRunRecord, status: OrchestratorRunStatus): OrchestratorRunRecord {
  const timeline = run.statusTimeline.includes(status) ? run.statusTimeline : [...run.statusTimeline, status];
  return {
    ...run,
    status,
    statusTimeline: timeline
  };
}
```
Source: `src/main.tsx`

### Delegated task timeline build pattern
```typescript
task = appendTaskStatus(task, "delegating", timestamp);
task = appendTaskStatus(task, "delegated", timestamp);
task = appendTaskStatus(task, "running", timestamp);
task = appendTaskStatus(task, "completed", timestamp);
```
Source: `src/shared/orchestrator-delegation.ts`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| ------------ | ---------------- | ------------ | ------ |
| Inline run/task mutation spread across UI | Shared domain helpers + typed status unions | Current repository baseline | Better determinism and testability with lower regression risk |

**Deprecated/outdated:**
- Ad-hoc string statuses outside union types in `src/shared/state.ts` should be treated as invalid and filtered.

## Open Questions

1. **Should run lifecycle transition guards reject invalid jumps at runtime or silently normalize?**
   - What we know: normalization currently filters invalid persisted records.
   - What's unclear: desired UX for in-session invalid transitions (throw vs coerce).
   - Recommendation: start with deterministic coercion + explicit test coverage, then tighten to hard failures if safe.

2. **How far should phase 5 go on renderer component extraction from `src/main.tsx`?**
   - What we know: the file is large and high-risk for broad edits.
   - What's unclear: whether extraction scope fits phase boundary without cross-phase churn.
   - Recommendation: keep extraction minimal (helper modules + wiring) and defer major component split to a later phase.

## Sources

### Primary (HIGH confidence)
- `src/main.tsx` — orchestrator run lifecycle handler + UI rendering path
- `src/shared/state.ts` — canonical status types and normalization guards
- `src/shared/orchestrator-delegation.ts` — delegated task timeline model
- `src/shared/orchestrator-failure.ts` — deterministic run failure taxonomy
- `src/shared/orchestrator-run-history.ts` — session-scoped run selectors
- `src/shared/*.test.ts` orchestrator-related suites

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/intel/summary.md`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly sourced from repository dependencies and current implementation
- Architecture: HIGH - derived from existing code boundaries and tested patterns
- Pitfalls: HIGH - backed by observed monolithic renderer flow and timeline/state contracts

**Research date:** 2026-02-18
**Valid until:** 2026-03-20
