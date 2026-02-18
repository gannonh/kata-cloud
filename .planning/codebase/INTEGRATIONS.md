# External Integrations

**Analysis Date:** 2026-02-18

## APIs & External Services

**Model provider APIs:**
- Anthropic API - model listing and execution
  - SDK/Client: internal fetch client in `src/main/providers/anthropic/api-key-client.ts`
  - Auth: API key via runtime auth payload (`ProviderClientAuth`)
- OpenAI API - model listing and execution
  - SDK/Client: internal fetch client in `src/main/providers/openai/api-key-client.ts`
  - Auth: API key via runtime auth payload (`ProviderClientAuth`)

**Developer services:**
- GitHub REST API - PR workflow/session checks in `src/git/pr-workflow.ts`
  - Auth: GitHub token provided through app session (`createGitHubSession`)

## Data Storage

**Databases:**
- Not detected

**File Storage:**
- Local filesystem persistence only
  - App state JSON in userData path via `src/main/persisted-state-store.ts`
  - Notes/spec docs under repo `notes/` directory

**Caching:**
- In-memory maps in process (for example session/status maps in `src/git/pr-workflow.ts` and `src/git/space-git-service.ts`)

## Authentication & Identity

**Auth Provider:**
- Custom per-provider API key resolution in `src/main/provider-runtime/auth.ts`
  - Implementation: provider runtime adapters resolve/validate auth mode before API calls

## Monitoring & Observability

**Error Tracking:**
- No external service detected

**Logs:**
- `console.error`/`console.warn` in main/runtime services (`src/main/index.ts`, `src/main/persisted-state-store.ts`, provider runtime files)

## CI/CD & Deployment

**Hosting:**
- Not applicable (desktop app repository)

**CI Pipeline:**
- GitHub Actions workflows in `.github/workflows/`
  - quality gates, smoke E2E, full E2E, and Claude automation workflows

## Environment Configuration

**Required env vars:**
- `KATA_CLOUD_RENDERER_URL` (dev renderer URL override)
- `KATA_CLOUD_ELECTRON_NO_SANDBOX` (CI/E2E runtime flag)

**Secrets location:**
- GitHub Actions repository secrets for workflow auth tokens (for example Claude action secrets)
- Provider API keys supplied at runtime through app UI/session payloads

## Webhooks & Callbacks

**Incoming:**
- None detected in application runtime code

**Outgoing:**
- HTTPS requests to provider APIs and GitHub API via `fetch` in provider clients and PR workflow service

---

*Integration audit: 2026-02-18*
