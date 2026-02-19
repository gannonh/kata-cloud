# Kata Cloud

Spec-driven development desktop app. Developers orchestrate specialized AI agents
to move from prompt to reviewable pull request in one workflow.

## Status

**v0.1.0** — Orchestrator and Context Engine Expansion (shipped 2026-02-19)

## Tech Stack

Electron + React 19 + TypeScript + pnpm

## Development

```bash
pnpm install
pnpm run dev          # Full Electron app
pnpm run web:dev      # Renderer only (Vite)
pnpm test             # Vitest
pnpm run desktop:typecheck
pnpm run e2e          # Electron E2E suite
```

## License

MIT
