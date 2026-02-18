---
phase: 05-orchestrator-lifecycle-determinism
plan: 02
subsystem: orchestrator
tags: [orchestrator, view-model, run-history, vitest]
requires:
  - phase: 05-01
    provides: deterministic run lifecycle semantics used by downstream projections
provides:
  - Shared run/task projection helper for renderer-facing lifecycle and diagnostics text
  - Deterministic run-history selector ordering under timestamp ties
affects: [renderer, status-panel, history-panel]
tech-stack:
  added: []
  patterns: [view-model projection, deterministic tie-break sorting]
key-files:
  created:
    - src/shared/orchestrator-run-view-model.ts
    - src/shared/orchestrator-run-view-model.test.ts
  modified:
    - src/shared/orchestrator-run-history.ts
    - src/shared/orchestrator-run-history.test.ts
key-decisions:
  - "Move status/failure rendering text assembly to shared projection helpers consumed by UI."
  - "Use updatedAt -> createdAt -> id ordering for deterministic history ties."
patterns-established:
  - "Renderer should consume projected run models instead of re-implementing lifecycle text logic."
duration: 30min
completed: 2026-02-18
---

# Phase 5 Plan 02 Summary

**Shipped shared run/task projection models and deterministic history ordering so UI status rendering no longer depends on ad-hoc per-view logic.**

## Performance

- **Duration:** 30 min
- **Completed:** 2026-02-18T15:14:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added run projection helper with stable lifecycle text, context preview, and delegated-task diagnostics.
- Added focused projection tests for no-task, failed-task, run-level failure, and snippet-preview edge cases.
- Tightened run-history selector tie behavior and added tests to lock ordering guarantees.

## Task Commits

1. **Run view model + history deterministic ordering** - `99678d3` (feat)

**Plan metadata:** _pending (summary commit will include PLAN + SUMMARY)_

## Files Created/Modified

- `src/shared/orchestrator-run-view-model.ts` - Shared projection helpers for latest run and run history UI rows.
- `src/shared/orchestrator-run-view-model.test.ts` - Deterministic projection coverage across failure and context edge cases.
- `src/shared/orchestrator-run-history.ts` - Deterministic tie-break sorting.
- `src/shared/orchestrator-run-history.test.ts` - Tie-break regression tests.

## Decisions Made

- Kept projection output presentation-friendly but still data-centric (no CSS concerns).
- Preserved run-history input order immutability while making ties deterministic across runs.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

Renderer can now wire lifecycle/status rendering via shared projection helpers without duplicating logic in JSX.

---
*Phase: 05-orchestrator-lifecycle-determinism*
*Completed: 2026-02-18*
