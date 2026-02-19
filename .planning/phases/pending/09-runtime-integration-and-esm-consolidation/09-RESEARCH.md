# Phase 9: Runtime Integration and ESM Consolidation - Research

**Researched:** 2026-02-19  
**Domain:** Provider-backed orchestrator execution, PI adapter integration, and preload/main module-path consolidation  
**Confidence:** HIGH

## Summary

Phase 9 should close three foundational gaps before broader UI-heavy MVP work:

1. **Real provider-backed orchestration is not yet wired into the run flow.**  
   The orchestrator run handler in `src/main.tsx` still terminates with local draft generation (`createSpecDraft`) and deterministic mock delegation, even though provider runtime IPC and adapters already exist.
2. **PI acceleration should be integrated as an adapter boundary, not a full replacement.**  
   `pi-mono` packages are ESM-first and align with project direction, but should be introduced behind an explicit runtime mode gate to preserve rollback safety.
3. **Desktop build path still relies on a CommonJS preload side-build.**  
   `desktop:build-main` compiles preload with `--module commonjs` into `dist/preload/index.cjs` via `bin/postbuild-main.mjs`, which conflicts with the ESM-first module strategy.

Recommended phase structure:
- Plan 01: Provider-backed orchestrator execution slice (native runtime path)
- Plan 02: PI adapter integration with feature-gated runtime switching
- Plan 03: ESM consolidation for preload/main build/runtime path

## Current Baseline

### Runtime and orchestration baseline

- Provider runtime IPC and adapters are implemented:
  - `kata-cloud/provider:resolve-auth`
  - `kata-cloud/provider:list-models`
  - `kata-cloud/provider:execute`
- Provider service and adapters exist in main process:
  - `src/main/provider-runtime/service.ts`
  - `src/main/providers/anthropic/*`
  - `src/main/providers/openai/*`
- Orchestrator run flow in renderer (`src/main.tsx`) does not call `providerExecute`.

### Build/module baseline

- Root package is ESM (`"type": "module"` in `package.json`).
- Main TS config is NodeNext (`tsconfig.main.json`).
- Preload is currently forced through a CommonJS side-build:
  - `desktop:build-main` script compiles preload with `--module commonjs`
  - `bin/postbuild-main.mjs` copies `dist/preload-cjs/preload/index.js` to `dist/preload/index.cjs`
  - BrowserWindow preload path targets `../preload/index.cjs`

### PI package baseline

- `pi-mono` and relevant published packages (`@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`) are ESM (`"type": "module"`).
- Integration risk is architectural, not module-format mismatch.

## Standard Stack

- **Electron + React + TypeScript** (existing app architecture)
- **Existing Provider Runtime** (`src/main/provider-runtime/*`) as primary abstraction boundary
- **Vitest + Electron Playwright** for deterministic regression and shell bridge behavior
- **PI packages (incremental)**:
  - `@mariozechner/pi-ai`
  - `@mariozechner/pi-agent-core` (if needed for agent/runtime shape)

No new framework is required.

## Architecture Patterns

### Pattern 1: Runtime adapter seam for orchestrator generation

Use a narrow orchestrator-generation adapter in renderer/main wiring so run flow can switch between:
- native provider runtime path (existing)
- PI-backed path (new, gated)

This avoids embedding provider-specific branching directly in `onRunOrchestrator`.

### Pattern 2: Feature-gated integration mode

Add explicit runtime mode control (`native` vs `pi`) at state/config boundary, then route through shared execution adapter.

This preserves:
- deterministic fallback behavior
- rollback path without invasive refactors
- easier test matrices

### Pattern 3: Single-path preload build output

Remove the dedicated CJS preload side-build and converge on a single TypeScript build flow aligned with NodeNext/ESM strategy.

Keep smoke coverage (`e2e:electron:smoke`) as non-negotiable regression gate for bridge integrity (`window.kataShell`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
| --- | --- | --- | --- |
| Provider execution in run flow | New parallel provider stack | Existing `ProviderRuntimeService` + IPC contracts | Prevents duplicate auth/model/error semantics |
| PI adoption | Full runtime rewrite | Adapter implementation behind runtime-mode gate | Lowers blast radius and keeps rollback trivial |
| Module migration | Ad hoc file-copy transforms | Unified TS build + explicit preload target contract | Reduces packaging drift and hidden build debt |

## Common Pitfalls

### Pitfall 1: Replacing deterministic run lifecycle with provider coupling

Provider-backed text generation should plug into existing lifecycle helpers, not bypass them.

### Pitfall 2: PI integration without kill switch

Without explicit runtime mode gating, PI onboarding becomes hard to rollback during v0.2 pressure.

### Pitfall 3: ESM migration that breaks preload bridge

Module cleanup must keep `window.kataShell` bridge behavior intact across dev and packaged modes.

### Pitfall 4: Scope bleed into UI parity work

Phase 9 must establish execution/runtime foundations for Phases 10-13, not attempt full UX parity.

## Code Examples

### Current local-draft terminal run behavior

```typescript
// src/main.tsx
const draft = failureMessage ? undefined : createSpecDraft(endedRun, endedAt, contextSnippets);
```

### Existing provider runtime execute entrypoint

```typescript
// src/main/provider-runtime/service.ts
async execute(request: ProviderExecuteIpcRequest): Promise<ProviderExecuteResult>
```

### Current preload CJS side-build handoff

```javascript
// bin/postbuild-main.mjs
const source = "dist/preload-cjs/preload/index.js";
const target = "dist/preload/index.cjs";
```

## Candidate File Targets

- `src/main.tsx`
- `src/shared/state.ts`
- `src/shared/orchestrator-run-view-model.ts`
- `src/shared/orchestrator-run-view-model.test.ts`
- `src/shared/shell-api.ts`
- `src/main/provider-runtime/service.ts`
- `src/main/provider-runtime/types.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `package.json`
- `tsconfig.main.json`
- `bin/postbuild-main.mjs`
- `bin/playwright-electron-runner.mjs`

## Sources

### Primary (HIGH confidence)
- `src/main.tsx`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/shared/shell-api.ts`
- `src/main/provider-runtime/*`
- `package.json`
- `bin/postbuild-main.mjs`
- `docs/design/specs/README.md`
- `.planning/REQUIREMENTS.md`

### External confirmation (HIGH confidence)
- `https://github.com/badlogic/pi-mono`
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/package.json`
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/package.json`
- `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/agent/package.json`

## Metadata

**Confidence breakdown:**
- Runtime gap assessment: HIGH
- PI integration feasibility (module compatibility): HIGH
- ESM consolidation scope: HIGH

**Research date:** 2026-02-19  
**Valid until:** 2026-03-21
