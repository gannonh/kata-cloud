# Kata Cloud

## What This Is

Kata Cloud is a desktop app for spec-driven development where developers orchestrate specialized AI agents instead of writing most code directly. It combines a living spec, isolated git worktrees, and coordinated agent execution so teams can move from prompt to reviewable pull request inside one workflow. The current product is local-first and desktop-first (Electron + React), with cloud/web and broader deployment modes planned for later phases.

## Core Value

The spec is the source of truth that stays aligned with real implementation while agents execute, so every workflow reliably produces a high-quality, reviewable pull request.

## Current Milestone: v0.2.0 Desktop MVP Closure

Goal: Close the gap between the current deterministic orchestration foundation and the intended MVP desktop UX with visible, real agent execution.

Target features:
- Three-column coordinator experience aligned with design specs (agent/status sidebar, conversation center, living spec right panel)
- Real provider-backed orchestrator execution surfaced as observable agent deployments and wave progress
- PI package integration path that accelerates runtime capabilities without breaking current workflows
- ESM-first desktop runtime cleanup to remove remaining CommonJS build path debt
- Completion flow parity (commit UX, permission dialog, verification reporting) plus release-grade validation

## Current State

Shipped v0.1.0 with 14,724 LOC TypeScript across 201 files.
Tech stack: Electron + React 19 + TypeScript + pnpm.
Orchestrator lifecycle is deterministic with validated state transitions.
Context retrieval contracts are typed with structured diagnostics.
Interrupted-run recovery and context provenance tracking are operational.
Integrated Electron UAT covers orchestrator + context flows end-to-end.
UI specifications produced from 29 design mocks covering 7 feature areas (`docs/design/specs/`), with component inventories, interaction maps, and implementation gap analysis against the current codebase.

## Requirements

### Validated

- ✓ Desktop shell with persistent app/session state and strict main/preload/renderer boundaries — existing
- ✓ Space creation and metadata management with local workspace linkage — existing
- ✓ Git lifecycle integration for spaces (branch/worktree init/switch, status, diffs, staging) — existing
- ✓ Living spec editing with autosave, task parsing, and threaded comments — existing
- ✓ Orchestrator run lifecycle with specialist delegation and run-history/status modeling — existing
- ✓ Changes-to-PR workflow including draft generation and PR creation hardening — existing
- ✓ In-app localhost browser preview for iterative dev workflows — existing
- ✓ Context adapter foundation with filesystem provider and MCP-compatible stub — existing
- ✓ Provider runtime foundation + Anthropic/OpenAI API-key execution path slices — existing
- ✓ UAT-to-E2E codification baseline with Electron Playwright smoke/full CI split — existing
- ✓ Deterministic orchestrator run lifecycle transitions and status projections — v0.1.0
- ✓ Typed context retrieval contracts with structured error handling and diagnostics — v0.1.0
- ✓ Run-history recoverability with malformed payload normalization — v0.1.0
- ✓ Interrupted-run startup recovery with context provenance tracking — v0.1.0
- ✓ Integrated Electron UAT for orchestrator + context flows — v0.1.0
- ✓ Focused guardrail suite with verification evidence codification — v0.1.0

### Active

- [ ] v0.2.0 requirement baseline established in `.planning/REQUIREMENTS.md`
- [ ] Coordinator UX semantics match design specs in `docs/design/specs/` (left agent/status, center chat, right living spec)
- [ ] Real LLM/provider calls and agent deployment lifecycle are observable in orchestrator UI
- [ ] PI packages are integrated through a controlled adapter path with rollback safety
- [ ] Electron runtime path is ESM-first with CommonJS debt retired
- [ ] Completion/verification UX and release guardrails are MVP-ready

### Out of Scope

- Cloud multi-tenant backend, billing, licensing, and account system — deferred to future cloud mode phases
- Full plugin/marketplace ecosystem — deferred until orchestrator/context reliability baseline is complete
- Enterprise deployment variants (VPC/on-prem/air-gapped) — deferred to later roadmap phases
- Provider runtime UI expansion beyond minimum orchestration dependencies — deferred to a later milestone

## Context

Kata Cloud consolidates prior Kata R&D into one product: spec-driven development + multi-agent orchestration + context-aware execution. The product direction and positioning are defined in `docs/kata-cloud-ovweview.md` and `.planning/PRD.md`, with execution baseline tracked in `notes/spec.md`.

Core workflows are implemented and merged through foundational slices (desktop shell, space/git lifecycle, spec panel, orchestration basics, context adapter foundation, provider-runtime base, and Playwright smoke/E2E baseline). v0.1.0 added reliability and depth in orchestration plus context retrieval.

v0.2.0 planning inputs combine three sources: previously defined v0.2 scope, PI integration feasibility, and the front-end specification corpus (`docs/design/specs/README.md` + 7 detailed specs). The design specs call out specific cross-cutting gaps (chat renderer, agent sidebar, wave grouping, terminal/browser tabs, permission dialog, commit UI, markdown spec rendering) that now define MVP closure criteria.

Current implementation includes provider runtime IPC and adapters, but orchestrator runs still generate local draft content via `createSpecDraft` in `src/main.tsx` rather than executing provider-backed generation in the run flow. This mismatch is now tracked as a primary v0.2 requirement.

The team operates with strict branch hygiene and slice discipline: start from fresh `origin/main`, keep single-purpose PRs, avoid cross-scope edits, and require explicit validation artifacts (`test`, `desktop:typecheck`, targeted E2E/UAT evidence).

## Constraints

- **Tech stack**: Electron + React 19 + TypeScript + pnpm — aligns with existing codebase and local-first desktop requirements.
- **Workflow**: Spec-driven, PR-centric delivery — every meaningful change must flow through auditable, scoped PRs.
- **Git discipline**: Fresh `origin/main` branch starts, clean working tree, non-overlap scope guardrails — prevents cross-task contamination.
- **Quality gates**: Lint, strict typecheck, coverage thresholds, and e2e smoke/full gates — required for merge confidence.
- **State integrity**: Orchestrator and context state persistence must remain deterministic across save/reload/restart boundaries.
- **Scope control**: Milestone execution excludes broad unrelated feature expansions to preserve atomic PR hygiene and deterministic validation.
- **Module strategy**: ESM-first TypeScript runtime — no net-new CommonJS runtime paths.
- **Integration risk control**: PI adoption must be incrementally gated with feature toggles and rollback path.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep spec-driven workflow as product center | Maintains alignment between intent, execution, and reviewable output | ✓ Good |
| Treat pull request as the core deliverable | Makes agent work auditable and team-compatible | ✓ Good |
| Build desktop-first local mode before cloud mode | Needed for filesystem/git control and rapid MVP iteration | ✓ Good |
| Support both Anthropic and OpenAI provider runtimes | Different models/providers fit different task profiles and risk posture | ✓ Good |
| Prioritize orchestrator/context reliability before broader expansion | Stable execution core is prerequisite for scaling workflow depth | ✓ Good |
| Use native Vitest invocation for guardrail commands | Avoids wrapper tooling overhead; leverages existing test infrastructure | ✓ Good |
| State-based assertions for Electron UAT | More reliable than timing-based waits; deterministic prompt-targeted assertions | ✓ Good |
| Treat v0.2.0 as MVP closure milestone | Aligns roadmap to user-visible UX parity and observable real execution before broader expansion | ✓ Good |
| Integrate PI packages incrementally behind adapters | Balances acceleration with isolation, testability, and rollback safety | — Pending |
| Move desktop runtime to ESM-only pathways | Removes module-format drift and unblocks clean TypeScript-first integration | — Pending |

---
*Last updated: 2026-02-19 after v0.2.0 milestone kickoff planning*
