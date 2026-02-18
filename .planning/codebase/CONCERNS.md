# Codebase Concerns

**Analysis Date:** 2026-02-18

## Tech Debt

**Renderer root complexity:**
- Issue: `src/main.tsx` is very large (about 1972 lines) and mixes navigation, orchestration, git UI, browser state, and PR workflows
- Files: `src/main.tsx`
- Impact: high merge-conflict risk and slower feature iteration due to tight coupling
- Fix approach: extract view-specific hooks/components (Explorer, Orchestrator, Changes, Browser) into feature modules with focused state boundaries

**IPC channel duplication risk:**
- Issue: preload keeps a duplicated channel constant map that must stay in sync with shared contracts
- Files: `src/preload/index.ts`, `src/shared/shell-api.ts`
- Impact: channel drift can silently break renderer-main communication
- Fix approach: generate typed preload channel constants from shared source or add sync tests validating parity

## Known Bugs

**MCP context provider returns no snippets:**
- Symptoms: selecting MCP provider yields empty retrieval results
- Files: `src/context/providers/mcp-context-provider.ts`
- Trigger: any context retrieval request using `providerId: "mcp"`
- Workaround: use filesystem provider (`providerId: "filesystem"`)

## Security Considerations

**User-provided token handling in memory:**
- Risk: GitHub and model provider auth values are session-scoped and memory-resident without encrypted local storage layer
- Files: `src/git/pr-workflow.ts`, `src/main/provider-runtime/auth.ts`
- Current mitigation: no token persistence to disk in these services; HTTPS enforced for external browser opens in `src/main/index.ts`
- Recommendations: centralize secret lifecycle policy (masking, expiration, explicit clear-on-signout, audit logs)

## Performance Bottlenecks

**Filesystem context scanning breadth:**
- Problem: provider scans up to 250 files and reads content in process for each retrieval
- Files: `src/context/providers/filesystem-context-provider.ts`
- Cause: broad recursive scan with runtime regex matching
- Improvement path: index files once per root path and query against cached metadata/content windows

## Fragile Areas

**Git + PR workflow coupling:**
- Files: `src/git/space-git-service.ts`, `src/git/pr-workflow.ts`, `src/main.tsx`
- Why fragile: multi-step flows depend on repo cleanliness, staged state, and session auth alignment
- Safe modification: extend existing service tests before changing error semantics or staged-change summarization
- Test coverage: unit/integration tests exist but renderer integration path remains high-churn

## Scaling Limits

**Single-process orchestration:**
- Current capacity: app logic executes in one Electron main process and one renderer root
- Limit: heavy UI state and provider/gitrepo operations contend for responsiveness at larger workspace counts
- Scaling path: split expensive operations to worker/background tasks and move renderer state into smaller feature slices

## Dependencies at Risk

**Electron major-version drift:**
- Risk: frequent Electron and browser API changes may invalidate preload/IPC assumptions
- Impact: regressions in sandbox, context bridge, or CI Linux deps
- Migration plan: pin and periodically validate Electron upgrades with smoke + full E2E gates

## Missing Critical Features

**No production-grade observability integration:**
- Problem: runtime errors rely on console output only
- Blocks: robust incident diagnosis for user-reported failures in packaged builds

## Test Coverage Gaps

**Main/preload exclusion from coverage gate:**
- What's not tested: coverage thresholds skip `src/main/**` and `src/preload/**`
- Files: `vitest.config.ts`, `src/main/index.ts`, `src/preload/index.ts`
- Risk: critical process-boundary logic can regress without coverage pressure
- Priority: High

---

*Concerns audit: 2026-02-18*
