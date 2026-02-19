# Phase 6: Delegation + Context Contract Hardening - Research

**Researched:** 2026-02-19
**Domain:** Orchestrator history persistence and context adapter contract hardening across shared/main/preload/renderer boundaries
**Confidence:** HIGH

## Summary

Phase 6 should harden two seams that currently allow silent degradation:

1. **Context retrieval contract seam** (`src/context/*`, `src/main/index.ts`, `src/preload/index.ts`, `src/main.tsx`)
2. **Run-history persistence seam** (`src/main.tsx`, `src/shared/state.ts`, `src/shared/orchestrator-*`)

The current implementation keeps deterministic run status transitions from Phase 5, but it still returns plain snippet arrays for context retrieval and swallows retrieval failures into `[]` in renderer flow. This makes CTX-01/CTX-02 partially implemented but not contract-safe.

The run-history path persists runs, timelines, and delegated task outcomes today, but updates are written from broad state snapshots in `src/main.tsx` and rely on strict record validation in `normalizeAppState`. That can drop entire run records if any run payload segment is malformed, which is risky for ORCH-03 and ORCH-04.

**Primary recommendation:**
- Introduce a **typed context retrieval result/error contract** shared across process boundaries.
- Introduce **run-history persistence helpers** for append/update semantics that reduce stale-state overwrite risk.
- Surface **actionable context diagnostics** in orchestrator run records and UI projections instead of silently degrading to "no snippets".

## Current Baseline

### What is already strong

- Deterministic run lifecycle transitions are centralized in `src/shared/orchestrator-run-lifecycle.ts`.
- Run/delegated task timeline projection is centralized in `src/shared/orchestrator-run-view-model.ts`.
- Persisted state normalization is strict and defends against invalid records (`src/shared/state.ts`).
- Main process enforces root-path ownership check before context retrieval (`src/main/index.ts`).

### Current gaps relevant to Phase 6 requirements

- `ContextAdapter.retrieve()` returns `ContextSnippet[]` only; no typed error channel.
- Renderer `onRunOrchestrator` catches context errors and substitutes `[]` with console logging only.
- Context failure cause/remediation is not persisted per run, so prior runs are not diagnostic-complete.
- App-level state updates in `onRunOrchestrator` are assembled from snapshot copies (`queuedState`, `runningState`, `endedState`), creating stale write risk during long-running flow changes.
- Strict `normalizeAppState` run filtering can drop whole run records when one nested field is invalid, which can reduce historical recoverability.

## Requirement-to-Design Mapping

| Requirement | What must be true in implementation |
| ----------- | ----------------------------------- |
| ORCH-03 | Run records survive save/reload with lifecycle + delegated outcomes + diagnostics intact. |
| ORCH-04 | Orchestrator failures update run records deterministically without corrupting active session/spec state. |
| CTX-01 | Context retrieval request/response is explicit and typed at shared contract level. |
| CTX-02 | Context/provider failures return typed diagnostics with actionable remediation; renderer does not silently degrade. |

## Recommended Architecture Pattern

### Pattern 1: Typed context outcome contract (shared-first)

Create a shared result union for context retrieval:
- success payload (`snippets`, provider metadata)
- failure payload (`code`, `message`, `remediation`, `retryable`, `providerId`)

Keep the raw provider API internal, but ensure IPC-facing paths use this stable contract so preload/renderer remain version-safe.

### Pattern 2: Structured IPC error transport for context domain

Mirror provider-runtime's serialization pattern:
- main serializes typed context failures into JSON payload message
- shared parser deserializes in renderer
- renderer stores typed diagnostics in run record and view model

This avoids leaking opaque `Error.message` strings across IPC boundaries.

### Pattern 3: Run update helpers over broad snapshot mutation

Move run mutation behavior into focused shared helpers:
- enqueue run
- transition run by id
- finalize run with draft/context/delegation payloads

Use these helpers in renderer persistence flow to reduce accidental state clobber during asynchronous orchestration transitions.

### Pattern 4: Recoverability-first normalization for run history

When possible, drop invalid nested segments (e.g., one bad delegated task) while preserving otherwise valid run records with warning diagnostics. This is safer for ORCH-03 than dropping full runs for localized corruption.

## Candidate File Targets

### Context contract hardening

- `src/context/types.ts`
- `src/context/context-adapter.ts`
- `src/context/providers/filesystem-context-provider.ts`
- `src/context/providers/mcp-context-provider.ts`
- `src/shared/shell-api.ts`
- `src/preload/index.ts`
- `src/main/index.ts`
- `src/shared/context-ipc.ts` (new, likely)

### Run persistence + diagnostics

- `src/shared/state.ts`
- `src/shared/state.test.ts`
- `src/shared/orchestrator-state.test.ts`
- `src/shared/orchestrator-run-view-model.ts`
- `src/shared/orchestrator-run-view-model.test.ts`
- `src/main.tsx`
- `src/shared/orchestrator-run-history.ts` (if selector/filter semantics need diagnostics-aware projection)

## Pitfalls to Avoid

1. **Contract break without preload/main alignment**
   - Changing context types in shared only will break bridge wiring.
2. **Silent fallback remains in renderer**
   - Returning empty snippets for failures preserves current ambiguity and misses CTX-02.
3. **Broad `main.tsx` rewrites**
   - Keep scope to orchestration run flow and projection, not unrelated browser/git/spec panels.
4. **Overfitting to one provider**
   - Error contract must remain provider-agnostic (`filesystem`, `mcp`, future providers).

## Verification Strategy for Planning

Phase 6 plans should prove:
- contract-level tests for context success/failure outcomes
- renderer-visible diagnostics on context retrieval failure
- run history integrity tests across save/reload normalization paths
- no regression to deterministic lifecycle behavior introduced in Phase 5

## Open Questions

1. Should context retrieval failures be stored as a new top-level run field (e.g., `contextFailure`) or folded into `errorMessage` semantics?
   - Recommendation: dedicated field to prevent overloading run terminal failure semantics.

2. Should `normalizeAppState` salvage partially invalid run payloads or keep strict drop behavior?
   - Recommendation: salvage nested optional segments where safe (e.g., invalid delegated task entry), keep full drop for core lifecycle contract violations.

3. Should context retrieval failure make run terminal status `failed` or allow `completed` with warning?
   - Recommendation: keep terminal `failed` for hard retrieval errors in this milestone so CTX-02 remains explicit and actionable.

## Sources

### Primary (HIGH confidence)
- `src/main.tsx`
- `src/shared/state.ts`
- `src/shared/orchestrator-run-lifecycle.ts`
- `src/shared/orchestrator-run-view-model.ts`
- `src/context/types.ts`
- `src/context/context-adapter.ts`
- `src/context/providers/filesystem-context-provider.ts`
- `src/main/index.ts`
- `src/preload/index.ts`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`

## Metadata

**Confidence breakdown:**
- Contract hardening design: HIGH (directly based on current typed IPC and provider-runtime patterns)
- Run persistence risks: HIGH (directly observed in current async snapshot updates and strict normalization)
- Scope fit to milestone: HIGH (maps to ORCH-03/04 and CTX-01/02)

**Research date:** 2026-02-19
**Valid until:** 2026-03-20
