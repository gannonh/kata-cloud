# Roadmap: Kata Cloud

## Overview

Milestone execution is tracked as globally ordered phases.
Current focus is closing the desktop MVP and preparing the next milestone.

## Milestones

- 🔄 **v1.0 Desktop MVP Closure** — Phases 1-4 (in progress)
- ○ **v1.1 Orchestrator and Context Engine Expansion** — Phases TBD (planned)

## Current Milestone: v1.0 Desktop MVP Closure

**Goal:** Complete provider runtime UX/hardening and finalize MVP validation plus release handoff.

- [ ] Phase 1: Provider Runtime UX Wiring (Slice 6)
- [ ] Phase 2: Provider Runtime Hardening (Slice 7)
- [ ] Phase 3: MVP Verification and UAT Codification
- [ ] Phase 4: Release Readiness and Handoff

### Phase 1: Provider Runtime UX Wiring (Slice 6)

Goal: Ship renderer-facing provider settings/status UX backed by existing typed IPC contracts.

Requirements: PROV-01, PROV-02, PROV-03, PROV-04

Success Criteria (what must be TRUE):
  1. Renderer allows provider selection and persists the selected provider in app state.
  2. Renderer exposes provider auth inputs and round-trips them through the existing shell API bridge.
  3. Renderer shows auth resolution details including requested mode, resolved mode, and fallback application.
  4. Typed provider IPC errors render actionable status messaging without breaking non-provider UI flows.

### Phase 2: Provider Runtime Hardening (Slice 7)

Goal: Strengthen provider-runtime reliability and error handling with deterministic semantics and regression coverage.

Requirements: HARD-01, HARD-02, HARD-03, HARD-04

Success Criteria (what must be TRUE):
  1. Runtime errors map to structured taxonomy with remediation/retryability fields intact.
  2. Timeout and transport failure handling is explicit, deterministic, and covered by tests.
  3. Edge-case regression tests cover fallback policy and auth failure boundaries.
  4. Main/preload/provider runtime paths pass strict typecheck and provider-focused test suites.

### Phase 3: MVP Verification and UAT Codification

Goal: Validate full MVP flows and convert manual UAT outcomes into automated Electron Playwright coverage.

Requirements: VERI-01, VERI-02, VERI-03, VERI-04

Success Criteria (what must be TRUE):
  1. Full MVP flow executes successfully in coordinated UAT with explicit pass/fail evidence.
  2. New UAT scenarios are codified as Playwright tests in the same slice or immediate follow-up.
  3. CI smoke (`e2e:electron:smoke`) and full (`e2e`) remain green after scenario additions.
  4. Provider-runtime slices 1-7 have explicit GO/NO-GO verification outcomes recorded.

### Phase 4: Release Readiness and Handoff

Goal: Close milestone with release packet, documented residual risks, and prioritized follow-up plan.

Requirements: RELS-01, RELS-02, RELS-03

Success Criteria (what must be TRUE):
  1. Release handoff packet includes validated command matrix and known-risk mitigation guidance.
  2. Deferred backlog is prioritized for post-v1 execution with rationale.
  3. Spec/task records are synchronized to final milestone outcomes and deferred scope boundaries.

## Planned Milestones

### ○ v1.1 Orchestrator and Context Engine Expansion

**Goal:** Expand orchestration and context primitives beyond MVP closure.

**Target features:**
- Orchestrator intelligence improvements
- Deeper context engine capabilities
- Workflow expansion beyond MVP baseline

---
*Roadmap created: 2026-02-18*
*Last updated: 2026-02-18 — migrated ROADMAP.md to current format*
