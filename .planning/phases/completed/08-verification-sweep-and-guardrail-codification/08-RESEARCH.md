# Phase 8: Verification Sweep and Guardrail Codification - Research

**Researched:** 2026-02-19
**Domain:** Deterministic regression coverage for orchestrator/context behavior, Electron UAT codification, and milestone quality-gate evidence capture
**Confidence:** HIGH

## Summary

Phase 8 must close VERI-01, VERI-02, and VERI-03 by making reliability verification deterministic, repeatable, and reviewable.

The codebase already has strong building blocks:
- Shared orchestrator lifecycle and normalization tests in `src/shared/*`.
- Node-based persistence/context tests in `src/main/persisted-state-store.node.test.ts` and `src/context/context-adapter.node.test.ts`.
- Electron Playwright UAT scenarios in `bin/playwright-electron-runner.mjs`.

The remaining gaps are coordination and codification, not foundational tooling:
1. **VERI-01 gap:** Coverage exists but is distributed; there is no explicit orchestrator/context guardrail suite command that developers can run as a focused regression gate.
2. **VERI-02 gap:** UAT scenarios validate lifecycle and context diagnostics separately; Phase 8 should codify at least one integrated orchestrator + context story from prompt submission to reviewable persisted output.
3. **VERI-03 gap:** Required gates are run ad hoc; Phase 8 needs explicit evidence capture in phase artifacts (`08-UAT.md`, `08-VERIFICATION.md`) so milestone handoff is auditable.

Recommended phase structure:
- Plan 01: codify targeted Vitest guardrail suite.
- Plan 02: codify integrated Electron UAT scenario + matrix updates.
- Plan 03: execute required gates and record evidence artifacts.

## Current Baseline

### Existing test and E2E assets

- Unit/integration tests:
  - `src/shared/orchestrator-run-lifecycle.test.ts`
  - `src/shared/orchestrator-run-view-model.test.ts`
  - `src/shared/state.test.ts`
  - `src/main/persisted-state-store.node.test.ts`
  - `src/context/context-adapter.node.test.ts`
- Electron suite runner:
  - `bin/playwright-electron-runner.mjs`
  - Scenarios currently include `bridge-smoke`, `orchestrator-uat-lifecycle-persistence`, and `orchestrator-context-diagnostics-uat`.
- Coverage matrix:
  - `docs/e2e-electron-matrix.md`

### Relevant policy constraints

- UAT scenarios belong in the unified Electron runner, not a separate permanent test system.
- Suite split remains smoke vs uat vs full.
- E2E artifacts should remain in `output/playwright/`.

## Standard Stack

- **Vitest (`pnpm test`)** for shared/renderer and Node integration tests.
- **Playwright Electron (`bin/playwright-electron-runner.mjs`)** for smoke/UAT/full desktop verification.
- **Project docs and phase artifacts** for evidence:
  - `docs/e2e-electron-matrix.md`
  - `.planning/phases/.../*-UAT.md`
  - `.planning/phases/.../*-VERIFICATION.md`

No new testing framework is required for Phase 8.

## Architecture Patterns

### Pattern 1: Guardrail suite as a focused command (VERI-01)

Keep existing tests in place, but add a single curated regression entry point for orchestrator/context behavior. This improves reproducibility and avoids "which files do I run?" drift.

Targeted suite should cover:
- Normal lifecycle progression.
- Deterministic failure behavior.
- Resume/interrupted recovery behavior.
- Context diagnostics/fallback/provenance behavior.

### Pattern 2: Integrated Electron UAT scenario (VERI-02)

Keep scenario-level helpers in `bin/playwright-electron-runner.mjs`, then add one scenario that chains:
1. prompt-driven completed run,
2. deterministic failed run,
3. context diagnostic run (MCP unavailable),
4. post-diagnostic successful run,
5. relaunch persistence assertions.

This provides a single end-to-end proof from prompt entry to reviewable persisted run history.

### Pattern 3: Evidence-first verification artifacts (VERI-03)

Make quality-gate outcomes explicit in `08-UAT.md` and `08-VERIFICATION.md` with:
- command list,
- pass/fail status,
- timestamped run summary,
- artifact paths (screenshots/log excerpts),
- requirement-to-evidence mapping.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| Focused regression coverage | New custom test harness | Existing Vitest + scoped script in `package.json` | Keeps tooling consistent with repo conventions |
| Desktop UAT flow | Separate ad hoc Playwright entrypoint | Existing `bin/playwright-electron-runner.mjs` scenario/tag model | Preserves smoke/uat/full policy and CI compatibility |
| Evidence capture | Free-form notes only | Structured `08-UAT.md` and `08-VERIFICATION.md` | Enables traceable milestone handoff |
| UI verification | Brittle CSS-only selectors | Existing role/text/state snapshot helpers | Reduces flake and keeps assertions user-visible |

## Common Pitfalls

### Pitfall 1: Duplicate scenario logic instead of shared helpers

If the new integrated UAT scenario duplicates existing lifecycle/context helper code, future updates drift and tests become inconsistent.

**Avoidance:** Reuse `runOrchestratorPrompt`, snapshot helpers, and restart helpers in the runner.

### Pitfall 2: Tag drift between runner and matrix

Adding/updating a scenario without updating `docs/e2e-electron-matrix.md` makes suite membership unclear.

**Avoidance:** Update the matrix in the same change as runner scenario edits.

### Pitfall 3: Missing resume assertion in focused guardrails

Normal/failure coverage without restart/resume behavior does not satisfy Phase 8 requirements.

**Avoidance:** Include explicit interrupted/persistence checks in the targeted regression command.

### Pitfall 4: Quality gates run without evidence artifact updates

Command success alone does not satisfy VERI-03 if evidence is not captured in phase docs.

**Avoidance:** Treat `08-UAT.md` and `08-VERIFICATION.md` updates as required deliverables.

## Code Examples

### Existing deterministic run execution helper

```javascript
// bin/playwright-electron-runner.mjs
const completedRun = await runOrchestratorPrompt(page, completedPrompt, "completed");
const failedRun = await runOrchestratorPrompt(page, failedPrompt, "failed");
```

### Existing relaunch persistence validation pattern

```javascript
// bin/playwright-electron-runner.mjs
await context.relaunch();
await assertOrchestratorPersistenceAfterRestart(context.page, coverageEvidence);
```

### Existing context diagnostics assertion pattern

```javascript
// bin/playwright-electron-runner.mjs
const latestWithDiagnostic = await getLatestRunSnapshot(page);
if (!latestWithDiagnostic.latest?.contextRetrievalError) {
  throw new Error("Expected latest run to persist context retrieval diagnostics.");
}
```

## Candidate File Targets

- `package.json`
- `src/shared/orchestrator-run-lifecycle.test.ts`
- `src/shared/orchestrator-run-view-model.test.ts`
- `src/main/persisted-state-store.node.test.ts`
- `src/context/context-adapter.node.test.ts`
- `bin/playwright-electron-runner.mjs`
- `docs/e2e-electron-matrix.md`
- `.planning/phases/pending/08-verification-sweep-and-guardrail-codification/08-UAT.md`
- `.planning/phases/pending/08-verification-sweep-and-guardrail-codification/08-VERIFICATION.md`

