# Requirements: Kata Cloud

Defined: 2026-02-19
Core Value: The spec stays aligned with implementation while agent execution reliably produces reviewable pull requests.

## v1 Requirements

Requirements for milestone v0.2.0 Desktop MVP Closure.

### Experience Parity (Design-Spec Aligned)

- [x] **UX-01**: User can work in a three-column coordinator layout where left is agent/status context, center is coordinator conversation, and right is the living spec panel.
- [ ] **UX-02**: User can add center/right workspace tabs from `+` actions (agent, note, terminal, browser) within an active coordinator session.
- [x] **UX-03**: User can read and send messages in a chat-style thread with role attribution and timestamps instead of status-card-only rendering.
- [x] **UX-04**: User can inspect active agent deployments, task states, and completion status from the left sidebar and completion views.
- [x] **UX-05**: User can see guided workflow progression (Creating Spec, Implement, Accept changes) in the right panel when spec content is not yet finalized.

### Real Orchestration and Observability

- [x] **ORCH-01**: User-triggered orchestrator runs execute at least one real provider-backed generation call when credentials are configured (not local draft-only fallback).
- [ ] **ORCH-02**: User can see provider/model/run telemetry for orchestrator execution, including lifecycle events and surfaced run diagnostics.
- [ ] **ORCH-03**: User can inspect wave-grouped execution (`waveId`-backed) with per-wave summaries and agent/task associations.
- [x] **ORCH-04**: User receives typed remediation and deterministic terminal run outcomes when provider execution fails or is unavailable.

### Workspace Flow Completion

- [ ] **FLOW-01**: User can view the spec as rendered markdown sections (Goal, Tasks, Acceptance Criteria, Non-goals, Assumptions, Verification Plan) with living updates.
- [ ] **FLOW-02**: User can toggle task completion from either sidebar or spec panel with synchronized state.
- [ ] **FLOW-03**: User can enter a commit message and run an in-app "Commit all changes" action before PR creation.
- [ ] **FLOW-04**: User sees an in-app permission dialog for restricted git/shell operations with Always/Yes/No decision paths.
- [ ] **FLOW-05**: User can open integrated terminal/browser tabs to unblock waves and validate fixes from inside the session.

### PI Integration and Module Strategy

- [x] **PI-01**: PI package adoption is implemented through a controlled adapter boundary (starting with `pi-ai` and/or `pi-agent-core`) without breaking existing kataShell/provider contracts.
- [x] **PI-02**: Runtime behavior can be switched between native provider execution and PI-backed execution via an explicit feature flag/setting.
- [x] **PI-03**: Desktop runtime path is ESM-first, with CommonJS preload/runtime debt removed from the core milestone execution path.

### Verification and MVP Handoff

- [ ] **VERI-01**: Electron UAT covers one full v0.2 coordinator flow from prompt through spec application, changes review, commit, and PR draft/create readiness.
- [ ] **VERI-02**: Automated tests cover wave grouping, agent status projection, permission decisions, and commit workflow behavior.
- [ ] **VERI-03**: Milestone handoff includes requirement coverage mapping to design-spec gaps and a prioritized unresolved-post-MVP backlog.

## v2 Requirements

Deferred beyond v0.2.0:

### Cloud Expansion

- **CLOUD-01**: Multi-tenant hosted runtime and managed workspace orchestration.
- **CLOUD-02**: Billing/licensing/account management workflows.
- **CLOUD-03**: Team collaboration and shared cloud state.

### Enterprise Deployment Modes

- **ENT-01**: VPC/on-prem/air-gapped deployment variants.
- **ENT-02**: Enterprise policy integration and managed provider credentials.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud backend and account system in v0.2.0 | MVP closure is desktop-local and execution-visibility focused. |
| Full PI framework replacement of all existing systems in one milestone | Risk is too high; integration will be incremental and reversible. |
| Marketplace/plugin ecosystem | Not required for MVP closure and would dilute execution focus. |
| Large visual redesign beyond spec parity | Milestone targets convergence to existing design specs, not net-new design exploration. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PI-01 | Phase 9 | Complete |
| PI-02 | Phase 9 | Complete |
| PI-03 | Phase 9 | Complete |
| ORCH-01 | Phase 9 | Complete |
| ORCH-04 | Phase 9 | Complete |
| UX-01 | Phase 10 | Complete |
| UX-03 | Phase 10 | Complete |
| UX-04 | Phase 10 | Complete |
| UX-05 | Phase 10 | Complete |
| UX-02 | Phase 11 | Pending |
| ORCH-02 | Phase 11 | Pending |
| ORCH-03 | Phase 11 | Pending |
| FLOW-05 | Phase 11 | Pending |
| FLOW-01 | Phase 12 | Pending |
| FLOW-02 | Phase 12 | Pending |
| FLOW-03 | Phase 12 | Pending |
| FLOW-04 | Phase 12 | Pending |
| VERI-01 | Phase 13 | Pending |
| VERI-02 | Phase 13 | Pending |
| VERI-03 | Phase 13 | Pending |

Coverage:
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after Phase 10 completion*
