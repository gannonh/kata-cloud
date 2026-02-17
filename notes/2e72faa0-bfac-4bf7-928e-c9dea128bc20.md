---
id: 2e72faa0-bfac-4bf7-928e-c9dea128bc20
title: Add orchestrator run trigger and state lifecycle
parent: spec
created: "2026-02-16T23:23:02.508Z"
task:
  status: complete
  peerOrder: 100
  startedAt: "2026-02-16T23:34:00.807Z"
  assignedAgentIds: [agent-1f498bed-5fb4-4484-8c96-f627c3371073, agent-8c9e7cb7-464f-43c5-b6ac-c98a0d8a1a64]
  completedAt: "2026-02-16T23:37:38.323Z"
---

# Add orchestrator run trigger and state lifecycle

Implement the minimal run lifecycle so a prompt in the Orchestrator view can start a tracked run with deterministic status transitions.

## Scope
In scope: orchestrator prompt submit path, run state shape, and lifecycle state transitions in renderer/shared state.
Out of scope: model-provider integrations, PR workflows, and browser preview.

## Inputs
- [Spec](intent://local/note/spec)
- [Ship orchestrator planning loop and specialist task delegation](intent://local/task/55f46e5e-e243-4efc-971b-fd5cd1504a85)

## Definition of Done
- Prompt submission in Orchestrator view creates a run record with stable identifier.
- Run lifecycle states are explicit and observable (queued/running/completed/failed).
- State persists through existing app state persistence path.

## Verification
- `pnpm run desktop:typecheck`
- `pnpm test -- orchestrator`

## Implementation Update (Turn 1)

### Summary
Implemented orchestrator prompt submission to create and persist run records with deterministic lifecycle transitions (`queued -> running -> completed|failed`) and surfaced latest run status in the Orchestrator panel.

### Acceptance Criteria
- ✅ Prompt submission in Orchestrator view creates a run record with stable identifier.
- ✅ Run lifecycle states are explicit and observable (`queued`, `running`, `completed`, `failed`).
- ✅ Run state persists through existing app state persistence/normalization path.

### Changes
- `src/main.tsx`
  - Added `Run Orchestrator` action in Orchestrator panel.
  - Added run execution handler with deterministic status progression and failure path keyed by prompt content (`fail`).
  - Added run status rendering (latest run ID, prompt, lifecycle timeline, error message).
- `src/shared/state.ts`
  - Added orchestrator run state shape to `AppState`.
  - Added run validation/normalization logic for persisted state.
- `src/shared/state.test.ts`
  - Extended shared state tests to cover `orchestratorRuns` initialization and normalization.
- `src/shared/orchestrator-state.test.ts`
  - Added focused orchestrator lifecycle normalization tests.

### Verification
- `pnpm run desktop:typecheck`
  - PASS (exit 0)
  - Evidence: renderer+main `tsc --noEmit` completed without errors.
- `pnpm test -- orchestrator`
  - PASS (exit 0)
  - Evidence: Vitest completed with `Test Files 15 passed (15)` and `Tests 41 passed (41)`.

### Residual Risks
- Orchestrator run processing is deterministic/local placeholder logic only; it does not execute real provider calls (out of scope for this task).
- `pnpm test -- orchestrator` currently executes a broad suite (pattern matches do not isolate only orchestrator tests).

## Verification Update (Turn 2)

### Verification Summary
- Verdict: ✅ APPROVED (GO)
- Confidence: High

### Acceptance Criteria Checklist
- ✅ VERIFIED: Prompt submission in Orchestrator view creates a run record with stable identifier.
  - Evidence: `src/main.tsx:80` (run id generation), `src/main.tsx:413` (submit handler), `src/main.tsx:421` (queued run record append), `src/main.tsx:819` (Run Orchestrator trigger button), `src/main.tsx:947` (latest run id rendered).
  - Verification: Static review plus required test run `pnpm test -- orchestrator` PASS.
- ✅ VERIFIED: Run lifecycle states are explicit and observable (`queued`/`running`/`completed`/`failed`).
  - Evidence: `src/shared/state.ts:9` (status union), `src/main.tsx:426` (`queued`), `src/main.tsx:440` (`running`), `src/main.tsx:452` (`completed|failed`), `src/main.tsx:939` (timeline rendering), `src/shared/orchestrator-state.test.ts` (valid/invalid status normalization coverage).
  - Verification: Static review plus required test run `pnpm test -- orchestrator` PASS.
- ✅ VERIFIED: Run state persists through existing app state persistence path.
  - Evidence: `src/main.tsx:437`, `src/main.tsx:448`, `src/main.tsx:468` (all lifecycle transitions persisted via `persistState`), `src/shared/state.ts:51` (AppState includes `orchestratorRuns`), `src/shared/state.ts:170` (normalization retains linked persisted runs), `src/shared/state.ts:165` (initial persisted state shape includes run list).
  - Verification: Static review plus required commands PASS.

### Scope Check (Task-only)
- No evidence in Task 1 implementation files of out-of-scope provider runtime/auth, PR workflow, browser preview, or context-adapter integration work.
- Task-focused files reviewed: `src/main.tsx`, `src/shared/state.ts`, `src/shared/state.test.ts`, `src/shared/orchestrator-state.test.ts`.

### Findings (Severity-ranked)
- P0: None.
- P1: None.
- P2: None blocking Task 1 DoD.

### Evidence Index
- Commits reviewed: HEAD context only (no dedicated Task 1 commit identified in local history).
- Task notes reviewed: `2e72faa0-bfac-4bf7-928e-c9dea128bc20`, `spec`.
- Files/areas reviewed: `src/main.tsx`, `src/shared/state.ts`, `src/shared/state.test.ts`, `src/shared/orchestrator-state.test.ts`, plus working-tree change inventory.

### Tests/Commands Run
- `pnpm run desktop:typecheck` → PASS
- `pnpm test -- orchestrator` → PASS (15 files, 41 tests)

### Risk Notes
- `pnpm test -- orchestrator` currently matches a broad set of tests (not orchestrator-only), so failures in unrelated areas could affect this gate. Non-blocking for Task 1 acceptance.

### GO/NO-GO
- GO for Wave 2.1 Task 1 readiness.