# Kata Cloud

## What This Is

Kata Cloud is a desktop app for spec-driven development where developers orchestrate specialized AI agents instead of writing most code directly. It combines a living spec, isolated git worktrees, and coordinated agent execution so teams can move from prompt to reviewable pull request inside one workflow. The current product is local-first and desktop-first (Electron + React), with cloud/web and broader deployment modes planned for later phases.

## Core Value

The spec is the source of truth that stays aligned with real implementation while agents execute, so every workflow reliably produces a high-quality, reviewable pull request.

## Current Milestone: v0.1.0 Orchestrator and Context Engine Expansion

**Goal:** Strengthen orchestrator execution reliability and context quality so agent runs are predictable, observable, and resume-safe.

**Target features:**

- Deterministic orchestrator run controls and lifecycle visibility
- Context engine depth improvements beyond filesystem baseline
- Stronger delegation history, resume behavior, and failure diagnostics
- End-to-end reliability gates for orchestrator plus context workflows

## Requirements

### Validated

- ✓ Desktop shell with persistent app/session state and strict main/preload/renderer boundaries — existing (`src/main/index.ts`, `src/preload/index.ts`, `src/shared/state.ts`)
- ✓ Space creation and metadata management with local workspace linkage — existing (`src/main.tsx`, `src/space/*`)
- ✓ Git lifecycle integration for spaces (branch/worktree init/switch, status, diffs, staging) — existing (`src/git/*`)
- ✓ Living spec editing with autosave, task parsing, and threaded comments — existing (`src/features/spec-panel/*`, `src/notes/*`, `packages/task-parser/*`)
- ✓ Orchestrator run lifecycle with specialist delegation and run-history/status modeling — existing (`src/shared/orchestrator-*.ts`, `src/main.tsx`)
- ✓ Changes-to-PR workflow including draft generation and PR creation hardening — existing (`src/git/pr-workflow.ts`)
- ✓ In-app localhost browser preview for iterative dev workflows — existing (`src/browser/local-dev-browser.ts`, `src/main.tsx`)
- ✓ Context adapter foundation with filesystem provider and MCP-compatible stub — existing (`src/context/*`)
- ✓ Provider runtime foundation + Anthropic/OpenAI API-key execution path slices — existing (`src/main/provider-runtime/*`, `src/main/providers/*`)
- ✓ UAT-to-E2E codification baseline with Electron Playwright smoke/full CI split — existing (`scripts/playwright-electron-*.mjs`, `.github/workflows/*`)

### Active

- [ ] Improve orchestrator lifecycle reliability so run start, delegated execution, failure handling, and terminal outcomes are deterministic
- [ ] Expand context engine retrieval quality and provider integration surfaces for better spec/task grounding
- [ ] Harden restart/resume behavior so orchestration state and timelines persist predictably across app restarts
- [ ] Codify reliability and regression validation for orchestrator/context flows in automated tests and E2E coverage

### Out of Scope

- Cloud multi-tenant backend, billing, licensing, and account system in this milestone — deferred to future cloud mode phases
- Full plugin/marketplace ecosystem — deferred until orchestrator/context reliability baseline is complete
- Enterprise deployment variants (VPC/on-prem/air-gapped) in this milestone — deferred to later roadmap phases
- Provider runtime UI expansion beyond minimum orchestration dependencies — deferred to a later milestone

## Context

Kata Cloud consolidates prior Kata R&D into one product: spec-driven development + multi-agent orchestration + context-aware execution. The product direction and positioning are defined in `docs/kata-cloud-ovweview.md` and `docs/PRD.md`, with execution baseline tracked in `notes/spec.md`.

Core workflows are implemented and merged through foundational slices (desktop shell, space/git lifecycle, spec panel, orchestration basics, context adapter foundation, provider-runtime base, and Playwright smoke/E2E baseline). This milestone focuses on reliability and depth in orchestration plus context retrieval so downstream delivery is stable.

The team operates with strict branch hygiene and slice discipline: start from fresh `origin/main`, keep single-purpose PRs, avoid cross-scope edits, and require explicit validation artifacts (`test`, `desktop:typecheck`, targeted E2E/UAT evidence).

## Constraints

- **Tech stack**: Electron + React 19 + TypeScript + pnpm — aligns with existing codebase and local-first desktop requirements.
- **Workflow**: Spec-driven, PR-centric delivery — every meaningful change must flow through auditable, scoped PRs.
- **Git discipline**: Fresh `origin/main` branch starts, clean working tree, non-overlap scope guardrails — prevents cross-task contamination.
- **Quality gates**: Lint, strict typecheck, coverage thresholds, and e2e smoke/full gates — required for merge confidence.
- **State integrity**: Orchestrator and context state persistence must remain deterministic across save/reload/restart boundaries.
- **Scope control**: Milestone execution excludes broad unrelated feature expansions to preserve atomic PR hygiene and deterministic validation.

## Key Decisions

| Decision | Rationale | Outcome |
| -------- | --------- | ------- |
| Keep spec-driven workflow as product center | Maintains alignment between intent, execution, and reviewable output | ✓ Good |
| Treat pull request as the core deliverable | Makes agent work auditable and team-compatible | ✓ Good |
| Build desktop-first local mode before cloud mode | Needed for filesystem/git control and rapid MVP iteration | ✓ Good |
| Support both Anthropic and OpenAI provider runtimes | Different models/providers fit different task profiles and risk posture | ✓ Good |
| Prioritize orchestrator/context reliability before broader expansion | Stable execution core is prerequisite for scaling workflow depth | — Pending |

---
*Last updated: 2026-02-18 after milestone v0.1.0 initialization*
