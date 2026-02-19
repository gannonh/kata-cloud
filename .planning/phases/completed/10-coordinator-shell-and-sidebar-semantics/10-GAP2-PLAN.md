---
phase: 10-coordinator-shell-and-sidebar-semantics
gap: GAP-2
title: Rename "Orchestrator" to "Coordinator" in user-facing labels
severity: low
---

# GAP-2 Fix Plan: Naming Normalization

## Problem
Top nav button says "Orchestrator" while all coordinator shell components say "Coordinator." User-facing label should be "Coordinator" throughout. "Orchestrator" is an internal implementation term.

## Changes

### 1. Rename NavigationView value (`src/shared/state.ts`)

- Line 15: Change `"orchestrator"` to `"coordinator"` in NavigationView union type
- Line 128: Update `isNavigationView()` guard from `"orchestrator"` to `"coordinator"`
- Line 433: Update `createInitialAppState()` default `activeView` from `"orchestrator"` to `"coordinator"`

### 2. Update renderer references (`src/main.tsx`)

- Line 103: Update `viewOrder` array entry from `"orchestrator"` to `"coordinator"`
- Line 199-200: Update `toViewLabel()` to return `"Coordinator"` for the `"coordinator"` case
- Line 1371: Update space creation default `activeView` from `"orchestrator"` to `"coordinator"`
- Line 1556: Update conditional rendering check from `"orchestrator"` to `"coordinator"`

### 3. Update button labels

- `src/main.tsx` line 1807: Change `<h2>Orchestrator</h2>` to `<h2>Coordinator</h2>`
- `src/main.tsx` line 1833: Change "Run Orchestrator" to "Run Coordinator"
- `src/features/coordinator-shell/message-input-bar.tsx` line 37: Change "Run Orchestrator" to "Run Coordinator"

### 4. Update tests

- Any test snapshots or assertions referencing "Orchestrator" as a user-visible label
- E2E runner scenario selectors if they match on "Orchestrator" text

## Not changed (internal implementation names)
- `OrchestratorRunRecord`, `orchestratorRuns`, `onRunOrchestrator` — these are internal type/function names, not user-facing

## Verification

- `pnpm test`
- `pnpm run desktop:typecheck`
- `pnpm run e2e:electron:uat`
