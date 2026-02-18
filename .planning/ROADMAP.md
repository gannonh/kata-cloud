# Roadmap: Kata Cloud

## Overview

Milestone execution is tracked as globally ordered phases.
Current focus is making orchestrator and context behavior deterministic before broader expansion.

## Milestones

- 🔄 **v0.1.0 Orchestrator and Context Engine Expansion** — Phases 5-8 (in progress)
- ○ **v0.2.0 Desktop MVP Closure** — Phases TBD (planned)

## Current Milestone: v0.1.0 Orchestrator and Context Engine Expansion

**Goal:** Strengthen orchestrator execution reliability and context quality so agent runs are predictable, observable, and resume-safe.

- [ ] Phase 5: Orchestrator Lifecycle Determinism
- [ ] Phase 6: Delegation + Context Contract Hardening
- [ ] Phase 7: Resume Integrity and Context Consistency
- [ ] Phase 8: Verification Sweep and Guardrail Codification

### Phase 5: Orchestrator Lifecycle Determinism

**Goal**: Ensure run lifecycle transitions are deterministic and user-visible from trigger through terminal state.

**Requirements**: ORCH-01, ORCH-02

**Success Criteria** (what must be TRUE):
  1. User can trigger a run and always observe deterministic status progression to a terminal state.
  2. Delegated task cards show accurate in-flight and terminal statuses with failure context.
  3. Failure paths do not leave runs in ambiguous terminal state.

### Phase 6: Delegation + Context Contract Hardening

**Goal**: Stabilize delegated execution history and context adapter contracts with explicit typed error handling.

**Requirements**: ORCH-03, ORCH-04, CTX-01, CTX-02

**Success Criteria** (what must be TRUE):
  1. Historical runs retain complete lifecycle timelines and delegated outcomes after save/reload.
  2. Context retrieval requests and responses follow stable typed contracts with explicit error handling.
  3. Context/provider failures surface actionable diagnostics and do not silently degrade orchestration.

### Phase 7: Resume Integrity and Context Consistency

**Goal**: Guarantee restart/resume safety and stable context grounding across repeated orchestration runs.

**Requirements**: CTX-03, CTX-04, SESS-01, SESS-02, SESS-03

**Success Criteria** (what must be TRUE):
  1. App restart preserves orchestrator run history, delegated summaries, and active workflow linkage.
  2. Repeated runs in the same session use consistent context grounding and clearly expose provenance.
  3. Users can distinguish stale artifacts from active state and resume without corruption.

### Phase 8: Verification Sweep and Guardrail Codification

**Goal**: Lock reliability gains with deterministic automated regression coverage and milestone evidence.

**Requirements**: VERI-01, VERI-02, VERI-03

**Success Criteria** (what must be TRUE):
  1. Targeted orchestrator/context automated suites cover normal, failure, and resume flows.
  2. Electron E2E covers at least one full orchestrator + context scenario from prompt to reviewable result.
  3. Required quality gates remain green with explicit evidence captured for milestone handoff.

## Planned Milestones

### ○ v0.2.0 Desktop MVP Closure

**Goal:** Complete provider-runtime UX/hardening closure and finalize release-ready desktop MVP handoff.

**Target features:**
- Provider runtime UX polish and resiliency
- Full MVP UAT/E2E final sweep
- Release handoff packet and prioritized follow-up backlog

---
*Roadmap created: 2026-02-18*
*Last updated: 2026-02-18 — initialized milestone v0.1.0 roadmap*
