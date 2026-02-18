# Kata Cloud

## What This Is

Kata Cloud is a desktop app for spec-driven development where developers orchestrate specialized AI agents instead of writing most code directly. It combines a living spec, isolated git worktrees, and coordinated agent execution so teams can move from prompt to reviewable pull request inside one workflow. The current product is local-first and desktop-first (Electron + React), with cloud/web and broader deployment modes planned for later phases.

## Core Value

The spec is the source of truth that stays aligned with real implementation while agents execute, so every workflow reliably produces a high-quality, reviewable pull request.

## Requirements

### Validated

- ✓ Desktop shell with persistent app/session state and strict main/preload/renderer boundaries — existing (`src/main/index.ts`, `src/preload/index.ts`, `src/shared/state.ts`)
- ✓ Space creation and metadata management with local workspace linkage — existing (`src/main.tsx`, `src/space/*`)
- ✓ Git lifecycle integration for spaces (branch/worktree init/switch, status, diffs, staging) — existing (`src/git/*`)
- ✓ Living spec editing with autosave, task parsing, and threaded comments — existing (`src/features/spec-panel/*`, `src/notes/*`, `packages/task-parser/*`)
- ✓ Orchestrator run lifecycle with specialist delegation and run-history/status modeling — existing (`src/shared/orchestrator-*.ts`, `src/main.tsx`)
- ✓ Changes-to-PR workflow including draft generation and PR creation hardening — existing (`src/git/pr-workflow.ts`, merged spec baseline through PR #47)
- ✓ In-app localhost browser preview for iterative dev workflows — existing (`src/browser/local-dev-browser.ts`, `src/main.tsx`)
- ✓ Context adapter foundation with filesystem provider and MCP-compatible stub — existing (`src/context/*`)
- ✓ Provider runtime foundation + Anthropic/OpenAI API-key execution path slices — existing (`src/main/provider-runtime/*`, `src/main/providers/*`, through merged slices 1-4)
- ✓ UAT-to-E2E codification baseline with Electron Playwright smoke/full CI split — existing (`scripts/playwright-electron-*.mjs`, `.github/workflows/*`)

### Active

- [ ] Complete Provider Runtime Slice 5: token-session auth mode integration with deterministic fallback semantics for Anthropic and OpenAI (no renderer UX in this slice)
- [ ] Complete Provider Runtime Slice 6: renderer settings/status UX for provider auth health, mode visibility, and execution wiring
- [ ] Complete Provider Runtime Slice 7: hardening pass (timeouts/retries/error polish/regression expansion)
- [ ] Run end-to-end MVP verification across full user journey (space -> spec -> delegate -> changes -> PR) and codify any remaining manual UAT scenarios into Playwright
- [ ] Prepare first production-ready milestone packaging for local-first desktop MVP with explicit residual risk handoff

### Out of Scope

- Cloud multi-tenant backend, billing, licensing, and account system in this milestone — deferred to future cloud mode phases
- Full plugin/marketplace ecosystem — deferred until core workflow is stable and validated
- Enterprise deployment variants (VPC/on-prem/air-gapped) in current MVP slice — deferred to later roadmap phases
- Broad unrelated feature work during scoped provider-runtime slices — excluded to preserve atomic PR hygiene and deterministic validation

## Context

Kata Cloud consolidates prior Kata R&D into one product: spec-driven development + multi-agent orchestration + context-aware execution. The product direction and positioning are defined in `docs/kata-cloud-ovweview.md` and `docs/PRD.md`, with the living execution state tracked in `notes/spec.md`.

Current repository state is brownfield and active: core desktop workflows are already implemented and merged through a sequence of scoped PRs (including context integration, browser preview, provider-runtime slices 1-4, and Electron E2E codification). The immediate execution focus is Provider Runtime Slice 5 (`notes/dfb65dc8-1eb9-47f1-b95f-e22c99005ddb.md`), specifically deterministic token-session fallback behavior and typed failure semantics.

The team operates with strict branch hygiene and slice discipline: start from fresh `origin/main`, keep single-purpose PRs, avoid cross-scope edits, and require explicit validation artifacts (`test`, `typecheck`, and targeted UAT/E2E evidence). This workflow is central to how work is delegated and merged.

## Constraints

- **Tech stack**: Electron + React 19 + TypeScript + pnpm — aligns with existing codebase and local-first desktop requirements.
- **Workflow**: Spec-driven, PR-centric delivery — every meaningful change must flow through auditable, scoped PRs.
- **Git discipline**: Fresh `origin/main` branch starts, clean working tree, non-overlap scope guardrails — prevents cross-task contamination.
- **Quality gates**: Lint, strict typecheck, coverage thresholds, and e2e smoke/full gates — required for merge confidence.
- **Provider behavior**: Deterministic auth resolution and preserved error taxonomy (`missing_auth`, `invalid_auth`, `session_expired`, etc.) — required for reliable multi-provider execution.
- **Scope control**: Provider runtime slices must not include renderer UX until designated slice — enforces atomicity and reduces regression surface.

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| Keep spec-driven workflow as product center | Maintains alignment between intent, execution, and reviewable output | ✓ Good |
| Treat pull request as the core deliverable | Makes agent work auditable and team-compatible | ✓ Good |
| Build desktop-first local mode before cloud mode | Needed for filesystem/git control and rapid MVP iteration | ✓ Good |
| Support both Anthropic and OpenAI provider runtimes | Different models/providers fit different task profiles and risk posture | ✓ Good |
| Implement provider runtime via small deterministic slices | Limits blast radius and preserves clear validation per capability | ✓ Good |
| Enforce non-overlap guardrails on active slices | Prevents mixed-scope regressions and review ambiguity | ✓ Good |
| Defer renderer settings UX to dedicated Slice 6 | Keeps Slice 5 focused on auth semantics and fallback correctness | — Pending |

---
*Last updated: 2026-02-18 after initialization*
