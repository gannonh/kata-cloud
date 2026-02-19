---
status: complete
phase: 10-coordinator-shell-and-sidebar-semantics
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md]
started: 2026-02-19T22:00:00Z
updated: 2026-02-19T23:10:00Z
---

## Tests

### 1. Typecheck passes
expected: `pnpm run desktop:typecheck` completes with zero errors
result: pass

### 2. Unit tests pass
expected: `pnpm test` passes with all coordinator-shell tests green
result: pass (233/233 tests, 41 files)

### 3. UAT E2E suite passes
expected: `pnpm run e2e:electron:uat` completes with coordinator-shell-semantics-uat scenario passing
result: pass (6/6 scenarios including coordinator-shell-semantics-uat)

### 4. Three-column orchestrator layout
expected: Switching to Orchestrator view shows three-column layout — left sidebar, center chat pane, right workflow/spec panel
result: pass

### 5. Left sidebar Agents section
expected: Left sidebar contains an Agents section with disclosure toggle that expands/collapses agent rows with status indicators
result: pass

### 6. Left sidebar Context section
expected: Left sidebar contains a Context section with disclosure toggle that expands/collapses context chip rows with action buttons
result: pass

### 7. Center column composition
expected: Center column shows coordinator conversation only; spec content belongs exclusively in right column
result: fail (severity: high)
notes: |
  Center column includes a "Coordinator | Spec" tab strip that conflates center and right column responsibilities.
  Per design, center column is for agent conversations and terminals only. Spec belongs in right column.
  Additionally, right column renders full Spec Note editor (markdown source, preview, threads) inline
  instead of as a tabbed document within its own tab strip.

### 8. Message input composer
expected: Bottom of center pane shows a text input bar for composing messages with submit affordance
result: pass

### 9. Workflow panel progression
expected: Right panel shows workflow steps (Creating Spec / Implement / Accept) with visual status indicators for the current run phase
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0

## Gaps

### GAP-1: Center/right column responsibility separation (high)
The center column contains a "Coordinator | Spec" tab strip. The Spec tab and its content
must be removed from the center column. The right column should own all documentation
artifacts (spec, notes, tasks, browsers). The center column should own agent conversations
and terminals only.

Fix scope:
- Remove "Spec" tab from center column tab strip in coordinator shell
- Ensure right column renders spec as a tabbed document (not inline editor dump)
- Each content column needs its own tab strip with "+" menu (center: New Agent, New Terminal; right: New Note, New Browser)

### GAP-2: Naming inconsistency — "Orchestrator" vs "Coordinator" (low)
Top nav button says "Orchestrator" while all coordinator shell components say "Coordinator."
Per design, user-facing label should be "Coordinator." "Orchestrator" is an internal
implementation term.

Fix: Rename nav button label from "Orchestrator" to "Coordinator."

### Design context captured during UAT

Three-column mental model (documented for future phases):

| Column | Role | MVP Content Types |
|--------|------|-------------------|
| Left | Status & admin | Agents list, Context, Changes, Files |
| Center | Communication & activity | Agent conversations, Terminals |
| Right | Documentation artifacts | Spec, Notes, Tasks, Browsers |

Each content column (center + right) has its own tab strip with "+" menu.
Clicking an agent in the left sidebar opens that agent's conversation as a tab in center.
Clicking a task in the spec opens that task note as a tab in right.
