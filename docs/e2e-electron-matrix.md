# Electron E2E Coverage Matrix

This matrix defines how Playwright Electron scenarios map to suite tags.

## Commands

- `pnpm run e2e:electron:smoke`: run smoke-tagged scenarios only.
- `pnpm run e2e:electron:uat`: run UAT-verification scenarios only.
- `pnpm run e2e:electron:full`: run all scenarios (superset of smoke + uat).
- `pnpm run e2e`: alias to `e2e:electron:full`.

## Scenario Matrix

| Scenario ID | Purpose | Included in `smoke` | Included in `uat` | Included in `full` |
| --- | --- | --- | --- | --- |
| `bridge-smoke` | Validate Electron preload bridge wiring and Changes view shell availability. | Yes | No | Yes |
| `orchestrator-uat-lifecycle-persistence` | Validate orchestrator completed/failed/completed lifecycle transitions, failure diagnostics, and persistence after restart. | No | Yes | Yes |
| `changes-no-repo-link-uat` | Validate Changes flow works without repo URL metadata once root path is configured. | No | Yes | Yes |
| `pr-redaction-uat` | Validate PR draft redacts sensitive-file diff contents. | No | Yes | Yes |

## Policy

- Any scenario created to verify manual UAT behavior must be tagged for `uat`.
- Every `uat` scenario must run under `full`.
- Pull-request CI should run `smoke`; `main` and scheduled runs should run `full`.
