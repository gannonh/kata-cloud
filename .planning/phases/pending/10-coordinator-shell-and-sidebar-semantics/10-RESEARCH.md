# Phase 10: Coordinator Shell and Sidebar Semantics - Research

**Researched:** 2026-02-19
**Domain:** React 19 coordinator workspace shell semantics (layout, accessibility, chat-thread UX)
**Confidence:** HIGH

## Summary

Phase 10 should be implemented as a renderer-only restructuring of the current three-panel shell into spec-aligned semantics: agent/context sidebar (left), chat-first coordinator pane (center), and spec/workflow pane (right). Keep Electron main/preload contracts unchanged for this phase; focus on view-model projection and accessible UI behavior in the renderer.

The standard approach is: keep `AppState` as the persisted source of truth, introduce a dedicated coordinator-shell view model layer for display semantics, and isolate transient UI interaction state (expanded rows, selected chips, compose draft, panel collapse) in a local reducer scoped to the coordinator screen.

Accessibility and interaction semantics should follow APG patterns directly for tabs and disclosure sections, and ARIA live-region guidance for chat/status updates. This is the highest-leverage way to deliver UX parity without introducing avoidable dependency churn.

**Primary recommendation:** Implement Phase 10 with native React + CSS Grid + APG-compliant semantics, backed by a reducer-driven UI state model and stable message/task identifiers.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
| ------- | ------- | ------- | ------------ |
| `react` | `^19.0.0` (repo) | Component/state model for shell UI | Already adopted in repo; official guidance covers state identity and reducer patterns |
| `react-dom` | `^19.0.0` (repo) | DOM rendering and event model | Current renderer runtime |
| CSS Grid (`minmax`) | Baseline since 2017 | Three-column shell sizing and collapse behavior | Native, stable browser support; matches current layout direction |
| WAI-ARIA APG patterns | Current | Keyboard + semantics for tabs/disclosure/splitter behavior | Canonical accessibility behavior for this UI class |

### Supporting

| Library | Version | Purpose | When to Use |
| ------- | ------- | ------- | ----------- |
| `@testing-library/react` | `^16.1.0` (repo) | User-visible interaction testing | Keyboard navigation, ARIA state, collapse/expand, chat updates |
| `vitest` | `^3.0.5` (repo) | Fast unit/component tests | Reducer/view-model logic and interaction guards |
| `playwright-core` + Electron runner | `^1.58.2` (repo) | End-to-end UAT verification | Three-column behavior and workflow semantics in desktop runtime |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| ---------- | --------- | -------- |
| Native APG implementation | Headless primitives (e.g., tabs/collapsible packages) | Faster initial accessibility wiring, but adds dependency and styling abstraction overhead into an already custom shell |
| Local reducer for coordinator UI | Multiple `useState` clusters in `src/main.tsx` | Lower upfront refactor effort, but higher regression risk in a large monolithic component |

**Installation:**

```bash
# Phase 10 baseline requires no new runtime dependencies.
# Use existing workspace tools.
pnpm run desktop:typecheck && pnpm test
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/coordinator-shell/          # NEW: phase-10 UI semantics
│   ├── view-model.ts                    # run/session -> sidebar/chat/workflow projection
│   ├── ui-state.ts                      # reducer + actions for transient UI state
│   ├── left-sidebar.tsx                 # agents/context/disclosure sections
│   ├── chat-thread.tsx                  # message list, status row, composer
│   └── workflow-panel.tsx               # right-panel stepper + spec affordances
├── shared/
│   └── state.ts                         # persisted contracts remain source of truth
└── main.tsx                             # orchestration + composition, reduced inline UI complexity
```

### Pattern 1: View-model projection before rendering

**What:** Derive coordinator-facing structures (`sidebarAgents`, `chatMessages`, `workflowSteps`) from persisted records instead of rendering raw `AppState` shape directly.

**When to use:** Any rendering path that currently consumes `orchestratorRuns`, `sessions`, and context snippets inline.

**Example:**

```ts
export type CoordinatorShellViewModel = {
  sidebarAgents: Array<{ id: string; label: string; status: string }>;
  chatMessages: Array<{ id: string; role: "user" | "coordinator"; body: string; createdAt: string }>;
  workflowSteps: Array<{ id: "creating-spec" | "implement" | "accept"; status: "active" | "pending" | "done" }>;
};

export function projectCoordinatorShell(input: {
  activeSessionId: string | null;
  runs: AppState["orchestratorRuns"];
}): CoordinatorShellViewModel {
  // Deterministic projection: pure function, easy to test.
  return {
    sidebarAgents: [],
    chatMessages: [],
    workflowSteps: []
  };
}
```

### Pattern 2: Reducer for transient UI semantics

**What:** Use a reducer for ephemeral UI state (collapsed sections, active tab, expanded pasted content, selected agent filter).

**When to use:** UI interactions that should not mutate persisted domain state until explicit user actions.

**Example:**

```ts
type UiState = {
  activeCenterTab: "coordinator" | "spec";
  collapsedSidebarSections: Record<string, boolean>;
  expandedMessageIds: Record<string, boolean>;
};

type UiAction =
  | { type: "toggle_sidebar_section"; sectionId: string }
  | { type: "set_center_tab"; tab: UiState["activeCenterTab"] }
  | { type: "toggle_message_expand"; messageId: string };

export function coordinatorUiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "toggle_sidebar_section":
      return {
        ...state,
        collapsedSidebarSections: {
          ...state.collapsedSidebarSections,
          [action.sectionId]: !state.collapsedSidebarSections[action.sectionId]
        }
      };
    case "set_center_tab":
      return { ...state, activeCenterTab: action.tab };
    case "toggle_message_expand":
      return {
        ...state,
        expandedMessageIds: {
          ...state.expandedMessageIds,
          [action.messageId]: !state.expandedMessageIds[action.messageId]
        }
      };
  }
}
```

### Pattern 3: APG-compliant interactive semantics

**What:** Implement tablist/disclosure behavior per APG keyboard and ARIA contracts.

**When to use:** Header tab strip and collapsible sidebar sections.

**Example:**

```tsx
<div role="tablist" aria-label="Coordinator workspace tabs">
  <button role="tab" aria-selected={isCoordinator} aria-controls="panel-coordinator" id="tab-coordinator">
    Coordinator
  </button>
  <button role="tab" aria-selected={!isCoordinator} aria-controls="panel-spec" id="tab-spec">
    Spec
  </button>
</div>

<button
  type="button"
  aria-expanded={!collapsed}
  aria-controls="agents-section"
>
  Agents
</button>
<section id="agents-section" hidden={collapsed}>
  ...
</section>
```

### Pattern 4: Layout as stable grid contract

**What:** Keep shell layout in CSS grid with explicit `minmax` tracks and class-based right-panel collapse.

**When to use:** Three-column shell and responsive behavior.

**Example:**

```css
.coordinator-shell {
  display: grid;
  grid-template-columns: 180px minmax(420px, 1.6fr) minmax(320px, 1.1fr);
  gap: 12px;
}

.coordinator-shell.is-right-collapsed {
  grid-template-columns: 180px minmax(420px, 1fr) 0;
}
```

### Anti-Patterns to Avoid

- **Ad-hoc state scatter in `src/main.tsx`:** Increases coupling and makes Phase 10 regressions likely.
- **Index/random keys for messages/tasks:** Causes incorrect React reconciliation and lost local state.
- **Non-semantic tab/disclosure widgets:** Fails keyboard/screen-reader behavior expected for this UI.
- **Persisting every temporary UI toggle into `AppState`:** Pollutes durable state and complicates migration.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
| ------- | ----------- | ----------- | --- |
| Tab keyboard semantics | Custom arrow/focus behavior without ARIA contract | APG Tabs pattern (`tablist`, `tab`, `tabpanel`, keyboard map) | Correct behavior has many edge cases (focus loop, activation model, labeling) |
| Collapsible sidebar sections | Div + click handlers only | APG Disclosure semantics (`button`, `aria-expanded`, `aria-controls`) | Ensures predictable keyboard and assistive behavior |
| Chat accessibility announcements | Manual screen-reader hacks | ARIA `log` for message stream and `status` for non-critical state updates | `log`/`status` already define polite live-region behavior |
| Pane sizing semantics (if resizable in this phase) | Pointer-only draggable dividers | APG Window Splitter role contract (`separator`, value attributes) | Keyboard + assistive compatibility is non-trivial |
| State transition orchestration | Implicit UI side-effects spread across handlers | Pure reducer + projection functions | Easier testing and safer evolution of shell semantics |

**Key insight:** The expensive part of this phase is semantic correctness and state coherence, not raw visual layout. Reuse standards for semantics and keep custom code focused on domain projection.

## Common Pitfalls

### Pitfall 1: State loss when switching tabs/panels

**What goes wrong:** Draft input, expanded pasted content, or selected filters reset unexpectedly.

**Why it happens:** React state is tied to component position/identity; conditional remounts or unstable keys discard local state.

**How to avoid:** Keep stable component identity for persistent subtrees; key only when intentional reset is desired.

**Warning signs:** User text disappears after switching panel; expanded rows collapse after unrelated rerender.

### Pitfall 2: Sidebar and chat become render-hotspots

**What goes wrong:** Layout jank or expensive rerenders when orchestration status updates.

**Why it happens:** Rendering directly from large `AppState` slices without memoized projection boundaries.

**How to avoid:** Project view models once per relevant dependency; isolate reducer state from persisted state writes.

**Warning signs:** Typing lag in prompt input while run status updates.

### Pitfall 3: Accessibility semantics are visually correct but behaviorally wrong

**What goes wrong:** UI appears fine but keyboard navigation and screen-reader output are incorrect.

**Why it happens:** Missing ARIA roles/states and APG keyboard contracts.

**How to avoid:** Implement APG semantics exactly for tabs/disclosure; use `role="log"` and `role="status"` for dynamic updates.

**Warning signs:** Arrow keys do nothing on tabs; collapsed sections are not announced; chat updates are silent.

### Pitfall 4: `minmax` track definitions create broken collapse behavior

**What goes wrong:** Hidden panel still consumes space or center pane overflows at narrow widths.

**Why it happens:** Invalid/unbalanced `minmax` ranges and no explicit collapsed template.

**How to avoid:** Define explicit collapsed grid templates and test at breakpoint boundaries.

**Warning signs:** Horizontal scrollbar appears after right panel collapse.

## Code Examples

Verified patterns from official sources and current project constraints:

### Chat stream + status semantics

```tsx
<section aria-labelledby="coordinator-thread-heading">
  <h2 id="coordinator-thread-heading">Coordinator conversation</h2>
  <ol role="log" aria-live="polite" aria-label="Coordinator message history">
    {messages.map((message) => (
      <li key={message.id}>
        <article>
          <header>{message.role}</header>
          <p>{message.body}</p>
        </article>
      </li>
    ))}
  </ol>
  <p role="status" aria-live="polite">
    {runStatusLabel}
  </p>
</section>
```

### Stable-key list rendering for thread/task rows

```tsx
<ul>
  {taskItems.map((task) => (
    <li key={task.id}>{task.title}</li>
  ))}
</ul>
```

### Reducer-oriented UI interactions

```ts
const [uiState, dispatchUi] = useReducer(coordinatorUiReducer, {
  activeCenterTab: "coordinator",
  collapsedSidebarSections: { sessions: false, agents: false, context: false },
  expandedMessageIds: {}
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
| ------------ | ---------------- | ------------ | ------ |
| Ad-hoc status cards for orchestration | Chat-first thread semantics with role/timestamp context | Ongoing in this milestone | Better parity with design specs and user mental model |
| Unstructured collapsible sections | APG disclosure semantics | Current accessibility guidance | Reliable keyboard/screen-reader behavior |
| Visual tab strips without complete tab semantics | APG tablist/tab/tabpanel model | Current accessibility guidance | Predictable focus management and interaction consistency |
| Scattered local state in very large component | Reducer + projection modules for complex UI domains | Established React guidance | Better testability and lower regression risk |

**Deprecated/outdated:**

- Index/random React keys for dynamic lists (causes incorrect reconciliation behavior).
- Treating chat updates as plain static content without live-region semantics.

## Open Questions

1. **Sidebar grouping strategy (discretion area)**
   - What we know: grouping/order is intentionally open in `10-CONTEXT.md`.
   - What's unclear: canonical hierarchy (status-first vs wave-first vs role-first).
   - Recommendation: choose one deterministic order in Phase 10 (e.g., status -> role) and defer alternative groupings to Phase 11.

2. **Persistence boundary for shell semantics**
   - What we know: selection/persistence semantics are discretionary in context.
   - What's unclear: which UI states should survive restart (collapsed sections, selected agent filter, composer draft).
   - Recommendation: persist only user-value states (active tab, draft text), keep purely visual toggles session-local.

3. **Right-pane collapse scope**
   - What we know: right pane must be collapsible.
   - What's unclear: whether collapse control must be keyboard-adjustable splitter now or simple toggle this phase.
   - Recommendation: deliver toggle-first in Phase 10; schedule full splitter mechanics if required by acceptance criteria.

## Sources

### Primary (HIGH confidence)

- Project roadmap and phase definition: `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/.planning/ROADMAP.md`
- Phase context: `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/.planning/phases/pending/10-coordinator-shell-and-sidebar-semantics/10-CONTEXT.md`
- Requirements mapping: `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/.planning/REQUIREMENTS.md`
- Current renderer baseline: `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/src/main.tsx`
- Design specs:
  - `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/docs/design/specs/02-coordinator-session.md`
  - `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/docs/design/specs/04-build-session.md`
  - `/Users/gannonhall/dev/kata/kata-cloud.worktrees/wt-a/docs/design/specs/06-wave-execution.md`
- React official docs:
  - [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
  - [Rendering Lists](https://react.dev/learn/rendering-lists)
  - [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
- WAI-ARIA APG:
  - [Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  - [Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  - [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
- MDN accessibility/layout references:
  - [ARIA: log role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/log_role)
  - [ARIA: status role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role)
  - [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
  - [minmax()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/minmax)

### Secondary (MEDIUM confidence)

- None required; primary sources were sufficient for this phase.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - based on current repository dependencies plus official docs.
- Architecture: HIGH - based on repository structure and React official guidance.
- Pitfalls: HIGH - based on React state identity rules + APG/MDN accessibility semantics.

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days)
