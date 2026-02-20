# Electron E2E Coverage Matrix

This matrix defines how Playwright Electron scenarios map to suite tags.

## Commands

- `pnpm run e2e:electron:smoke`: run smoke-tagged scenarios only.
- `pnpm run e2e:electron:uat`: run UAT-verification scenarios only.
- `pnpm run e2e:electron:full`: run all scenarios (superset of smoke + uat).
- `pnpm run e2e`: alias to `e2e:electron:full`.

## Test Runtime Assumptions

- Electron Playwright runs use deterministic provider runtime stubs by default (`KATA_CLOUD_E2E_PROVIDER_STUB=1`) so orchestrator UAT scenarios validate lifecycle/UI behavior without external API credentials.
- Set `KATA_CLOUD_E2E_PROVIDER_STUB=0` to run against real provider runtime adapters.

## Scenario Matrix

| Scenario ID                              | Purpose                                                                                                                                                | Included in `smoke` | Included in `uat` | Included in `full` |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ----------------- | ------------------ |
| `bridge-smoke`                           | Validate Electron preload bridge wiring and Changes view shell availability.                                                                           | Yes                 | No                | Yes                |
| `orchestrator-uat-lifecycle-persistence` | Validate orchestrator completed/failed/completed lifecycle transitions, failure diagnostics, and persistence after restart.                            | No                  | Yes               | Yes                |
| `orchestrator-context-diagnostics-uat`   | Validate typed context retrieval diagnostics (provider/code/remediation/retryable) appear in latest run, move into history, and persist after restart. | No                  | Yes               | Yes                |
| `orchestrator-provider-execution-uat`    | Validate orchestrator run snapshots include provider execution telemetry (provider/model/runtime/status) with deterministic E2E provider stubs.        | No                  | Yes               | Yes                |
| `coordinator-shell-semantics-uat`        | Validate coordinator three-column shell semantics: sidebar sections, chat-first composer, workflow guidance, and run-history rendering.                | No                  | Yes               | Yes                |
| `changes-no-repo-link-uat`               | Validate Changes flow works without repo URL metadata once root path is configured.                                                                    | No                  | Yes               | Yes                |
| `pr-redaction-uat`                       | Validate PR draft redacts sensitive-file diff contents.                                                                                                | No                  | Yes               | Yes                |

## Policy

- Any scenario created to verify manual UAT behavior must be tagged for `uat`.
- Every `uat` scenario must run under `full`.
- Pull-request CI should run `smoke`; `main` and scheduled runs should run `full`.
