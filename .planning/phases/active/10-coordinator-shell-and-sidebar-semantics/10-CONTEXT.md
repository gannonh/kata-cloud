# Phase 10: Coordinator Shell and Sidebar Semantics - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Align shell semantics to the spec-defined three-column coordinator workspace with an agent/status-aware left sidebar and a chat-first center pane.
This phase clarifies implementation behavior for shell layout, sidebar semantics, conversation presentation, and design-spec traceability.
New capabilities beyond this boundary are deferred to later phases.

</domain>

<decisions>
## Implementation Decisions

### Three-column shell behavior
- Left column remains fixed.
- Center and right columns are flexible.
- Right column is collapsible.

### Chat-first center pane interaction model
- Use a single chronological thread.
- Include explicit agent labels in the message stream.

### Design specification traceability
- Reference source for Phase 10 shell/sidebar implementation:
  - `docs/design/specs/02-coordinator-session.md` as the primary spec.
  - Include relevant sections from `docs/design/specs/04-build-session.md` and `docs/design/specs/06-wave-execution.md` when touched by the change.
- Spec references are required in:
  - Phase plan documents.
  - Pull request descriptions/checklists.
- If implementation and spec conflict:
  - Resolve case-by-case with an explicit decision log entry (document the chosen behavior and rationale).
- Enforcement mechanism:
  - Add a required `Spec refs` section in each Phase 10 plan file.
  - Include checklist confirmation in PR content.

### Claude's Discretion
- Sidebar grouping hierarchy (status/wave/role ordering and default grouping strategy).
- Selection and persistence semantics (session-local vs persisted behavior details).

</decisions>

<specifics>
## Specific Ideas

- Primary concern is preventing design spec files from slipping through implementation and review.
- Traceability must be explicit and visible in planning and PR workflow artifacts.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 10-coordinator-shell-and-sidebar-semantics*
*Context gathered: 2026-02-19*
