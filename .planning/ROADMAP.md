# Roadmap: Kata Cloud

## Overview

Milestone execution is tracked as globally ordered phases.
Current focus is executing v0.2.0 Desktop MVP Closure after shipping orchestrator and context reliability in v0.1.0.

## Milestones

- **v0.1.0 Orchestrator and Context Engine Expansion** — Phases 5-8 (shipped 2026-02-19)
- **v0.2.0 Desktop MVP Closure** — Phases 9-13 (active)

## Current Milestone: v0.2.0 Desktop MVP Closure

**Status:** Active (Phases 09-10 complete, Phase 11 pending planning/execution)

**Goal:** Deliver MVP UX parity with the design specs and make orchestrator execution visibly real (agent deployment + provider-backed generation) while preserving v0.1 reliability guarantees.

**Planning inputs:**
- Existing planned v0.2 scope from roadmap/milestones
- PI package integration opportunity (`pi-mono`) with ESM compatibility
- Front-end spec corpus (`docs/design/specs/README.md` and specs 01-07)

### Phase 10: Coordinator Shell and Sidebar Semantics

**Status:** Complete — 2026-02-19
**Depends on:** Phase 09
**Plans:** 3/3 complete

Plans:
- [x] 10-01-PLAN.md — Coordinator shell projection and transient UI state contracts
- [x] 10-02-PLAN.md — Sidebar/chat/workflow component primitives with accessibility semantics
- [x] 10-03-PLAN.md — App integration, three-column wiring, and UAT coverage

### Phase 11: Agent Deployment, Waves, and Tab Expansion

**Goal:** Add wave/deployment model visibility and support + flows for agent, note, terminal, and browser tab expansion.
**Depends on:** Phases 09-10
**Plans:** TBD

### Phase 12: Completion Workflow and Safety UX

**Goal:** Deliver completion parity with commit UX, permission model, markdown-first spec rendering, and unblock pathways.
**Depends on:** Phase 11
**Plans:** TBD

### Phase 13: MVP Verification and Release Handoff

**Goal:** Run release-grade UAT/E2E verification sweep and produce requirement-traceable MVP handoff artifacts.
**Depends on:** Phases 09-12
**Plans:** TBD

## Completed Milestones

<details>
<summary>v0.1.0 Orchestrator and Context Engine Expansion (Phases 5-8) — SHIPPED 2026-02-19</summary>

**Goal:** Strengthen orchestrator execution reliability and context quality so agent runs are predictable, observable, and resume-safe.

- [x] Phase 5: Orchestrator Lifecycle Determinism (3/3 plans) — completed 2026-02-18
- [x] Phase 6: Delegation + Context Contract Hardening (3/3 plans) — completed 2026-02-19
- [x] Phase 7: Resume Integrity and Context Consistency (2/2 plans) — completed 2026-02-19
- [x] Phase 8: Verification Sweep and Guardrail Codification (3/3 plans) — completed 2026-02-19

[Full archive](milestones/v0.1.0-ROADMAP.md)

</details>

## Planned Milestones

No additional milestones planned yet. Next milestone definition starts after v0.2.0 release audit.

---

## Progress Summary

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 5. Orchestrator Lifecycle Determinism | v0.1.0 | 3/3 | Complete | 2026-02-18 |
| 6. Delegation + Context Contract Hardening | v0.1.0 | 3/3 | Complete | 2026-02-19 |
| 7. Resume Integrity and Context Consistency | v0.1.0 | 2/2 | Complete | 2026-02-19 |
| 8. Verification Sweep and Guardrail Codification | v0.1.0 | 3/3 | Complete | 2026-02-19 |
| 9. Runtime Integration and ESM Consolidation | v0.2.0 | 3/3 | Complete | 2026-02-19 |
| 10. Coordinator Shell and Sidebar Semantics | v0.2.0 | 3/3 | Complete | 2026-02-19 |
| 11. Agent Deployment, Waves, and Tab Expansion | v0.2.0 | 0/TBD | Pending | — |
| 12. Completion Workflow and Safety UX | v0.2.0 | 0/TBD | Pending | — |
| 13. MVP Verification and Release Handoff | v0.2.0 | 0/TBD | Pending | — |

---
*Roadmap created: 2026-02-18*
*Last updated: 2026-02-19 — Phase 10 completed (plans 10-01, 10-02, 10-03)*
