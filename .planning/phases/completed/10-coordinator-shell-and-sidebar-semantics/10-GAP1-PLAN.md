---
phase: 10-coordinator-shell-and-sidebar-semantics
gap: GAP-1
title: Center/right column responsibility separation
severity: high
---

# GAP-1 Fix Plan: Column Responsibility Separation

## Problem
Center column contains a "Coordinator | Spec" tab strip. Spec content renders in both center and right columns. Per design, center column owns agent conversations only; right column owns documentation artifacts.

## Changes

### 1. Update coordinator shell types (`src/features/coordinator-shell/types.ts`)

- Add `CoordinatorRightTab = "workflow" | "spec"` type
- Remove `"spec"` from `CoordinatorCenterTab` (or remove the type entirely since center is single-purpose)
- Add `activeRightTab: CoordinatorRightTab` to `CoordinatorShellUiState`
- Add `{ type: "set-active-right-tab"; tab: CoordinatorRightTab }` to action union

### 2. Update coordinator shell reducer (`src/features/coordinator-shell/ui-state.ts`)

- Add `activeRightTab: "workflow"` to initial state
- Add `case "set-active-right-tab"` reducer handler
- Simplify or remove `case "set-active-tab"` (center is always "coordinator")

### 3. Update renderer integration (`src/main.tsx`)

**Center column (lines ~1575-1627):**
- Remove the `<nav>` element containing "Coordinator | Spec" tab buttons
- Remove the ternary that switches between coordinator chat and spec
- Always render `<CoordinatorChatThread>` + `<CoordinatorMessageInputBar>`

**Right column (lines ~1630-1648):**
- Add a tab strip with "Workflow" and "Spec" tabs
- Add `onSelectCoordinatorRightTab` callback wired to new action
- Conditionally render workflow stepper OR spec editor based on `activeRightTab`
- Spec editor renders in a `coordinator-spec` wrapper with "NOTES / Spec" header

**Tab callback (lines ~1436-1441):**
- Replace `onSelectCoordinatorTab` with `onSelectCoordinatorRightTab`
- Wire to `"set-active-right-tab"` action

### 4. Update tests

- `src/features/coordinator-shell/ui-state.test.ts` — add test for right tab switching
- `src/features/coordinator-shell/components.test.tsx` — verify center has no spec tab, right has tab strip

## Verification

- `pnpm test -- src/features/coordinator-shell/`
- `pnpm run desktop:typecheck`
- `pnpm run e2e:electron:uat`
- Manual: center column shows only chat + input bar, right column has Workflow/Spec tabs
