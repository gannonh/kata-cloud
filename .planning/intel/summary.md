# Codebase Intel Summary

Generated: 2026-02-18

This repository is an Electron + React desktop application (`kata-cloud`) with strict main/preload/renderer process boundaries and typed IPC contracts. Core behavior centers on workspace/session state persistence, git lifecycle orchestration, PR drafting/creation, and model-provider execution through Anthropic/OpenAI adapters.

Primary hotspots:
- `src/main.tsx` (large renderer orchestrator)
- `src/git/` (worktree/changes/PR services)
- `src/main/provider-runtime/` (provider auth/list/execute)

Reference docs:
- `.planning/codebase/STACK.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/TESTING.md`
- `.planning/codebase/INTEGRATIONS.md`
- `.planning/codebase/CONCERNS.md`
