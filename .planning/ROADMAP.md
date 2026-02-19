# Roadmap: Kata Cloud

## Overview

Milestone execution is tracked as globally ordered phases.
Current focus is executing v0.2.0 Desktop MVP Closure after shipping orchestrator and context reliability in v0.1.0.

## Milestones

- **v0.1.0 Orchestrator and Context Engine Expansion** — Phases 5-8 (shipped 2026-02-19)
- **v0.2.0 Desktop MVP Closure** — Phases 9-13 (active)

## Current Milestone: v0.2.0 Desktop MVP Closure

**Status:** Active (requirements defined, phase plans pending)

**Goal:** Deliver MVP UX parity with the design specs and make orchestrator execution visibly real (agent deployment + provider-backed generation) while preserving v0.1 reliability guarantees.

**Planning inputs:**
- Existing planned v0.2 scope from roadmap/milestones
- PI package integration opportunity (`pi-mono`) with ESM compatibility
- Front-end spec corpus (`docs/design/specs/README.md` and specs 01-07)

**Phase sequence (global):**
- [ ] **Phase 9: Runtime Integration and ESM Consolidation**
  - Lock provider-backed orchestrator execution path (replace local draft-only run path)
  - Integrate PI runtime adapters behind feature flags
  - Remove remaining CommonJS desktop runtime debt
- [ ] **Phase 10: Coordinator Shell and Sidebar Semantics**
  - Restructure workspace to spec-aligned left agent/status sidebar + center coordinator chat + right spec panel
  - Implement chat-style renderer and agent/task status surfaces
- [ ] **Phase 11: Agent Deployment, Waves, and Tab Expansion**
  - Add wave-aware orchestration model (`waveId`) and deployment hierarchy views
  - Implement center/right add-tab flows (agent/note/terminal/browser)
  - Surface real run telemetry (provider/model/run events) in-session
- [ ] **Phase 12: Completion Workflow and Safety UX**
  - Implement markdown-first living spec presentation and task synchronization
  - Add commit message + commit action flow in Changes
  - Implement permission dialog and unblock tooling (terminal/browser interactions)
- [ ] **Phase 13: MVP Verification and Release Handoff**
  - Codify full v0.2 UAT/E2E + regression guardrails
  - Capture MVP acceptance evidence, unresolved gap ledger, and release handoff packet

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
| 9. Runtime Integration and ESM Consolidation | v0.2.0 | 0/TBD | Pending | — |
| 10. Coordinator Shell and Sidebar Semantics | v0.2.0 | 0/TBD | Pending | — |
| 11. Agent Deployment, Waves, and Tab Expansion | v0.2.0 | 0/TBD | Pending | — |
| 12. Completion Workflow and Safety UX | v0.2.0 | 0/TBD | Pending | — |
| 13. MVP Verification and Release Handoff | v0.2.0 | 0/TBD | Pending | — |

---
*Roadmap created: 2026-02-18*
*Last updated: 2026-02-19 — v0.2.0 activated with phase sequence and planning inputs*
