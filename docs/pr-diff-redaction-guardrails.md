# PR Diff Snippet Redaction Guardrails (Issue #21)

Status: Proposal + shipped minimal mitigation (2026-02-18)

## Threat Model

Generated PR bodies currently include staged diff snippets. If sensitive values are accidentally staged, PR draft generation can duplicate those values into editable PR text and GitHub API payloads.

Primary leak paths:
- Diff preview includes secret values from application/config/env files.
- Diff preview includes token/password assignments in code or config.
- Very large diffs increase accidental exposure scope in one generated payload.

## Risk Matrix

| Risk | Example | Severity | Likelihood | Guardrail |
| --- | --- | --- | --- | --- |
| Secret values copied into PR body | API keys/tokens/passwords in staged diff | High | Medium | Pattern-based value redaction in diff preview |
| Sensitive config file contents copied | `.env`, key/cert/credential files | High | Medium | Sensitive-path diff section suppression |
| Overshared context from large diffs | Hundreds/thousands of changed lines | Medium | Medium | Hard truncation limits (line + char caps) |
| False negative secret formats | Unrecognized credential formats | High | Low-Medium | UI warning + follow-up hardening |

## Recommended Default Policy

1. Secret-pattern redaction
- Redact token/key/password-like assignments in diff snippet text.
- Redact known token signatures (for example GitHub token prefixes) and AWS access key IDs.

2. Sensitive file-glob suppression
- Suppress diff preview sections when file paths match sensitive patterns:
  - `.env*`
  - `.npmrc`
  - `.aws/credentials`
  - private key/certificate-like extensions (`.pem`, `.p12`, `.pfx`, `.key`, `.jks`)
  - credential/secret-like filenames

3. Truncation limits
- Keep preview bounded to 80 lines and 3000 characters after sanitization.

4. User-facing warning behavior
- Keep explicit warning text in PR draft UI instructing users to review generated snippets for sensitive content before submission.
- Future iteration should add explicit per-draft indicators when suppression/redaction occurred.

## Shipped In This Slice

- Diff preview sanitization in `src/git/pr-workflow.ts`:
  - Sensitive file section suppression placeholder in preview.
  - Secret/token pattern redaction in preview text.
  - Existing hard truncation limits made explicit constants.
- Test coverage in `src/git/pr-workflow.test.ts`:
  - Redaction behavior.
  - Sensitive-file suppression behavior.
  - Truncation limit behavior.

## Deferred Follow-ups

- Expand secret detectors (entropy-based and provider-specific patterns).
- Support user-configurable allow/deny path globs.
- Surface structured redaction/suppression metadata in draft response and UI.
- Add telemetry for suppression/redaction event counts (without secret values).
