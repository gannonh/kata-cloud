---
id: spec
title: Spec
tags: [spec]
pinned: true
created: "2026-02-16T13:56:39.341Z"
task:
  status: in_progress
---

> NOTE: `intent://local/task/[uuid]` resolves to a local markdown file with the specified UUID:
> Example: `intent://local/task/10a48d6c-9fd1-452f-aa99-3120bf23641c` → `notes/10a48d6c-9fd1-452f-aa99-3120bf23641c.md`

## Handoff Snapshot (2026-02-18, Post-PR #47)

This section is the current source of truth for handoff. Historical sections below are retained for audit trail but are superseded by this snapshot.

### Repository Baseline
1. `main` now includes the latest merged implementation slices:
   - PR `#30`: context adapter conflict-resolution integration.
   - PR `#31`: in-app browser preview implementation.
   - PR `#32`: provider runtime Slice 1 foundation.
   - PR `#33`: context retrieval contract v1 docs.
   - PR `#35`: responsive changes-panel heights.
   - PR `#36`: provider runtime Slice 2 IPC/main/preload wiring.
   - PR `#38`: changes diff syntax highlighting.
   - PR `#39`: PR workflow edge-case test expansion.
   - PR `#40`: provider runtime Slice 3 Anthropic API-key path.
   - PR `#41`: PR diff redaction/suppression guardrails.
   - PR `#42`: spec snapshot refresh after `#38-#41`.
   - PR `#44`: preload/runtime UAT fix for missing bridge channel wiring.
   - PR `#45`: local git lifecycle fix so initialized repos are actionable in Changes view.
   - PR `#46`: Electron Playwright smoke runner foundation.
   - PR `#47`: UAT codified as Electron Playwright E2E with CI split (`CI Quality Gates` smoke + standalone `Electron E2E Full`).
2. Coordination worktree baseline is clean and synced to `origin/main`.
3. Branch strategy remains enforced:
   - Start each new task branch from updated `origin/main`.
   - Keep scope isolated to one task per PR.
   - Avoid absolute worktree paths in notes/prompts; use repo-relative paths only.
   - Include explicit "Context to read first" sections in all implementation prompts.

### Completed Since Last Handoff
1. [Integrate context engine adapter and initial providers](intent://local/task/302fcffa-863d-4d90-b017-08369fad3f73) is complete and merged via PR `#30`.
2. [Add in-app browser preview for local development](intent://local/task/22770f24-a79b-4d14-9add-14ffd1447b2f) is complete and merged via PR `#31`.
3. [Implement real model provider runtime and authentication](intent://local/task/dfb65dc8-1eb9-47f1-b95f-e22c99005ddb) Slice 1 foundation is complete and merged via PR `#32`.
4. Context Engine interface guidance is documented in `docs/context-retrieval-contract-v1.md` via PR `#33`.
5. Changes panel responsive height remediation is complete via PR `#35`.
6. Provider runtime Slice 2 plumbing is complete via PR `#36`.
7. Changes diff syntax highlighting is complete via PR `#38`.
8. PR workflow edge-case coverage expansion is complete via PR `#39`.
9. Provider runtime Slice 3 (Anthropic API-key execution path) is complete via PR `#40`.
10. PR diff snippet redaction/suppression guardrails are complete via PR `#41`.
11. UAT remediation/spec sync refresh is complete via PR `#42`.
12. Preload bridge/runtime regression fix is complete via PR `#44`.
13. Changes-view git-linking false-negative fix is complete via PR `#45`.
14. Electron Playwright smoke harness setup is complete via PR `#46`.
15. UAT-to-E2E codification + CI workflow separation is complete via PR `#47`.

### Active Tasks
1. [Implement real model provider runtime and authentication](intent://local/task/dfb65dc8-1eb9-47f1-b95f-e22c99005ddb)
   - Status: `in_progress` (Slices 1, 2, and 3 merged).
   - Next gates: Slice 4 (OpenAI API-key runtime path), Slice 5 (token-session mode/fallback), Slice 6 (renderer settings/status UX), Slice 7 (hardening + regression sweep).
2. Spec/task hygiene
   - Status: `in_progress`.
   - Next gate: keep `notes/spec.md` top snapshot aligned after each merged PR and enforce context-first, repo-relative dispatch prompts.
3. UAT and test codification track
   - Status: `in_progress`.
   - Current state: the latest UAT remediation cycle is complete and codified in Electron Playwright E2E (`#46`, `#47`).
   - Next gate: continue codifying each new manual UAT scenario in the same PR (or linked immediate follow-up) as feature fixes land.

### Exact Next Steps
1. Merge this spec refresh PR so `notes/spec.md` reflects the post-`#47` baseline.
2. Dispatch Provider Runtime Slice 4 (OpenAI API-key execution path) from fresh `origin/main`.
3. Dispatch Provider Runtime Slice 5 (token-session mode + deterministic fallback semantics).
4. Dispatch Provider Runtime Slice 6 (renderer settings/status UX wiring and visibility).
5. Dispatch Provider Runtime Slice 7 hardening pass (error polish, retries/timeouts, regression coverage).
6. Run end-to-end MVP UAT sweep and codify any remaining manual-only flows into Electron Playwright tests.

### Next Steps After Open Tasks Complete
1. Execute full E2E MVP verification: space creation, orchestrator run lifecycle, spec draft/apply, changes-tab diff/staging, PR creation flow, browser preview, context retrieval, provider runtime.
2. Produce final release handoff packet with validated commands, residual risks, and recommended post-MVP backlog order.

## Goal
Close Wave 1 by verifying completed implementation tasks, unblocking the browser follow-up, and preparing a clean handoff package for your external outsourcing step.

## Tasks
- [x] Verify and close run-history task

- [/] Verify and close context-adapter task

- [x] [Resolve browser-task sequencing and next action](intent://local/task/14bc6806-c210-44a3-8acc-ebca2014ea78)

- [x] Prepare external-outsource handoff package

## Acceptance Criteria
1. Run-history and context tasks both receive verifier outcomes with explicit GO/NO-GO.
2. Browser task state is unambiguous (resumed with prerequisites met or explicitly blocked).
3. External handoff instructions are ready for you to use immediately.
4. Spec reflects the current source of truth for task states and next actions.

## Non-goals
1. Implementing new feature code in this coordination pass.
2. Changing historical notes outside status/result corrections.
3. Performing external outsourcing actions directly.

## Assumptions
1. External outsourcing execution is handled by you, not by in-system agents.
2. Existing implementation evidence in run-history/context notes is substantially complete and needs verification closure.
3. Browser task sequencing depends on confirmed closure of context/run-history verification (confirm?).

## Verification Plan
1. Confirm run-history closure evidence is recorded (PR `#24` merge + manual UAT restart persistence pass).
2. Ensure context task artifact completeness, then delegate verifier and record explicit GO/NO-GO.
3. Reconcile browser-task status based on context verifier output and execute next branch-from-main implementation step.
4. Proceed to provider runtime only after browser task merges cleanly.

## Rollback Plan
1. If verifier returns NO-GO, revert task status from `review_required/complete` to `in_progress`.
2. Add remediation items to the relevant task note and spec.
3. Re-run verification only after remediation evidence is posted.


## Stall Recovery Status (2026-02-17)

1. Closure task `374e17d5-6ac8-42ff-b943-66026957a892` is still in `in_progress` with no additional task-note updates after initial kickoff; treat as stalled.
2. Closure task `76dd55a0-e87d-4fc5-82bc-7878efc81bd5` is complete with NO-GO findings: context task `302fcffa-863d-4d90-b017-08369fad3f73` remains blocked by missing commit/push/remote-ref artifacts.
3. Browser sequencing task `14bc6806-c210-44a3-8acc-ebca2014ea78` and external handoff task `1ce25d50-a2ee-49ca-9f11-aae1f2869ad5` have not started.
4. Proposed recovery wave:
   a. Replace stalled run-history closure execution on `374e17d5-6ac8-42ff-b943-66026957a892`.
   b. Run `14bc6806-c210-44a3-8acc-ebca2014ea78` to lock browser next-action state from current evidence.
   c. Run `1ce25d50-a2ee-49ca-9f11-aae1f2869ad5` to produce your external handoff packet.
5. Verifier dispatch will follow each recovered task completion.

## Recovery Wave Dispatch (2026-02-17)

1. Stalled execution on `374e17d5-6ac8-42ff-b943-66026957a892` was replaced with new implementor agent `agent-4e138d04-03c3-4e22-b0c8-b6f34cfd5bf2`.
2. Browser sequencing task `14bc6806-c210-44a3-8acc-ebca2014ea78` dispatched to implementor agent `agent-158d1a82-e398-494f-81ca-99267d8f981c`.
3. External handoff package task `1ce25d50-a2ee-49ca-9f11-aae1f2869ad5` dispatched to implementor agent `agent-735d2a05-9c47-45fc-bae9-bf5f158c7cc1`.
4. All three were dispatched in one grouped wave with `wait_mode=after_all`; next step is verifier follow-on immediately when this wave returns.

## Run-history Ownership Enforcement (2026-02-17)

1. Conflict detected: two active agents on task `374e17d5-6ac8-42ff-b943-66026957a892` (`agent-1b62073a-7ae5-486d-8688-01c2213e7d5c` and `agent-4e138d04-03c3-4e22-b0c8-b6f34cfd5bf2`).
2. Coordinator enforced single-owner execution: `agent-4e138d04-03c3-4e22-b0c8-b6f34cfd5bf2` is authoritative owner.
3. Prior agent was issued a high-priority stand-down instruction and its future outputs are non-authoritative for closure decisions.

## Commit/Push Recovery Dispatch (2026-02-17)

1. Processed recovery-wave events: `14bc6806-c210-44a3-8acc-ebca2014ea78` and `1ce25d50-a2ee-49ca-9f11-aae1f2869ad5` completed.
2. Top task statuses updated to reflect current state (`run-history` in progress, `context-closure` done, `external handoff package` done).
3. High-priority implementor dispatch started for `302fcffa-863d-4d90-b017-08369fad3f73` to commit/push current uncommitted context-adapter work and attach full artifact evidence for PR handoff.

## Commit/Push Recovery Result (2026-02-17)

1. Context-adapter branch `feature/context-adapter-foundation` is now committed and pushed.
2. Commit: `ac97a5cf0ccc0191e3d45453a319cbeb268664c8` (`feat: add context adapter foundation`).
3. Remote ref verified: `ac97a5cf0ccc0191e3d45453a319cbeb268664c8\trefs/heads/feature/context-adapter-foundation`.
4. Required validations recorded as passing (`pnpm run test -- context`, `pnpm run desktop:typecheck`).
5. Working tree is clean on current branch; task `302fcffa-863d-4d90-b017-08369fad3f73` moved to `review_required` for verifier closeout.
## Goal
Restore a healthy Git baseline, recover the pre-reset feature work, and resume implementation from a clean, pushable branch.

## Tasks
- [x] [Recover pre-reset work into current workspace](intent://local/task/7a006ca5-e5df-4dfd-8134-70db25f8203c)

- [x] [Re-establish Git hygiene and branch/worktree cleanup](intent://local/task/51039010-2109-4c7f-9a24-5cf0f968f5eb)

- [/] [Outsource independent PR work and resume primary feature](intent://local/task/d7a5cef2-5289-444a-a5b7-21822d012663)


- [x] [Fix CI pnpm version pin for PR merge](intent://local/task/fb221374-7086-405f-a384-6fc2ac0c2eef)
## Acceptance Criteria
1. Pre-reset work is restored into the active workspace branch without data loss.
2. Git health checks pass with no garbage warnings or invalid refs.
3. Required stale session artifacts are cleaned locally/remotely without deleting active branches.
4. At least one feature task is actively resumed with clear delegation.
5. Outsourceable PR candidates and handoffs are documented.

## Non-goals
1. Rewriting published `main` history.
2. Deleting non-session branches without explicit approval.
3. Bundling all remaining feature work into one large PR.

## Assumptions
1. We should restore the full pre-reset branch tip (`fe3e028e5b5e7d7d273e011d5ae7e5483640b94c`) (confirm?).
2. Remote cleanup may delete only session branches (`codex/*`, `git-stability-incident`, `unblock-wave-1-verification`) (confirm?).
3. Highest-priority resume target remains run-history persistence (`c5f554ea-2059-40d2-9fb2-bf522a590cae`) (confirm?).

## Verification Plan
1. Run recovery and Git-health commands from Task 1 and Task 2.
2. Validate push capability from the recovered branch.
3. Verify spec includes outsourcing handoffs and delegated resume task.

## Rollback Plan
1. If the recovery branch is wrong, delete only the recovery branch and refetch from backup path.
2. If cleanup removes a needed branch, recreate from backup SHA and restore the remote ref.
3. If push fails, use documented fresh-clone fallback without changing recovered branch content.




## Recovery Checkpoint (2026-02-17)

1. Git branch tracking is now healthy on the active branch: `feature/run-history-persistence...origin/feature/run-history-persistence`.
2. Recovery content exists on remote at `origin/feature/run-history-persistence` -> `be71982fc9e214b689eb529d3e9b2cb1f4d9b99c`.
3. Local Git health checks remain clean (`garbage: 0`, no invalid-ref errors).
4. Stale `origin/codex/*` branches used during incident handling were removed.
5. Residual risk: direct large-pack pushes still intermittently fail with remote unpack/inflate errors; fallback publish path is the current mitigation.


## Branch Protection Update (2026-02-17)

Direct pushes to `main` are blocked by repository rules (`GH013`); integration to `main` must go through pull requests. Effective workflow: continue work on feature branches, open PRs targeting `main`, merge via GitHub, then sync local `main` from `origin/main`. This replaces any direct-push-to-main assumption.

## Integration Gate (2026-02-17)

1. PR #2 is open: https://github.com/gannonh/kata-cloud/pull/2 (`feature/run-history-persistence` -> `main`).
2. This PR merge is the required gate before outsourcing additional implementation work.
3. After merge, sync local `main` from `origin/main` and create all new work branches from that updated `main`.
4. Do not stack new feature branches on top of recovery branches.

## Integration Gate Result (2026-02-17)

1. PR #2 (`feature/run-history-persistence` -> `main`) merged at `2026-02-17T03:45:07Z`.
2. Merge commit on `main`: `1cadf1894f3a37d520c106af590ef102f8ce8f77`.
3. Gate is cleared: Wave 1 outsourcing can proceed.
4. All new work must branch from updated `main` and return via short-lived PRs.

## Wave 1 Execution Note (2026-02-17)

1. Run-history task (`c5f554ea-2059-40d2-9fb2-bf522a590cae`) encountered overlap with in-progress browser edits in shared workspace.
2. Coordinator approved isolated execution in a clean temporary worktree from updated `main` on `feature/run-history-persistence-fix`.
3. Task agent was re-notified and resumed with strict non-overlap constraints.

## Wave 1 Conflict Handling (2026-02-17)

1. Parallel file overlap occurred between browser preview and context adapter tasks on `src/shared/state.ts` and `src/shared/state.test.ts`.
2. Scope-separation rule applied: context task owns first-pass shared-state edits; browser task is paused for those files.
3. Browser task resumes on updated `main` after context task lands to avoid mixed-scope commits and preserve independent PR hygiene.

## Wave 1 Status (2026-02-17)

1. Browser preview task (`22770f24-a79b-4d14-9add-14ffd1447b2f`) is implemented and currently `review_required`; automated checks passed, manual localhost clickthrough remains for verifier.
2. Context adapter task (`302fcffa-863d-4d90-b017-08369fad3f73`) hit branch mismatch and was corrected to continue in isolated `feature/context-adapter-foundation` flow from updated `main`.
3. Run-history task (`c5f554ea-2059-40d2-9fb2-bf522a590cae`) remains in progress in isolated branch/worktree flow.
4. Wave 1 verifier delegation will start only after tasks 2 and 3 complete.

## Wave 1 Correction (2026-02-17)

1. Run-history task (`c5f554ea-2059-40d2-9fb2-bf522a590cae`) was reopened because prior completion lacked implementation artifacts (no commit hash/test evidence/files-changed summary in task note).
2. Task status reset to `in_progress` and re-instruction sent for clean-branch execution with mandatory evidence before verification.

## Wave 1 Recovery Action (2026-02-17)

1. Run-history task (`c5f554ea-2059-40d2-9fb2-bf522a590cae`) was re-delegated to replacement implementor `agent-e92c73d0-56ef-440e-a009-661b7c399382` after repeated non-progress responses.
2. Browser task (`22770f24-a79b-4d14-9add-14ffd1447b2f`) reset to `waiting` pending clean scope-separation with context shared-state edits.
3. Context task (`302fcffa-863d-4d90-b017-08369fad3f73`) instructed to finalize only on isolated `feature/context-adapter-foundation` with explicit artifacts.

## Wave 1 Ownership Clarification (2026-02-17)

Run-history replacement implementor `agent-e92c73d0-56ef-440e-a009-661b7c399382` is designated active owner and instructed to continue without waiting on prior stalled agent assignment.

## Wave 1 Cutover Control (2026-02-17)

1. Repeated stale/duplicate run-history agent events triggered forced execution cutover.
2. Original run-history agent was instructed to stand down; replacement agent remains sole owner.
3. Context task switched to execute-only mode with required artifact-based completion.
4. Browser task remains `waiting` until context/run-history complete and verifier can evaluate cross-task integration safely.

## Wave 1 Execution Control Update (2026-02-17)

1. Duplicate run-history execution was re-confirmed; original agent `agent-eadf6ee1-4de3-4edc-af4b-6f70458f1a9d` was instructed again to stand down.
2. Replacement run-history agent `agent-e92c73d0-56ef-440e-a009-661b7c399382` remains sole owner with mandatory artifact completion requirements.
3. Context agent `agent-8e0a4569-29d6-44b4-ac55-5ad7f2f7baa4` was re-instructed to execute-only on isolated `feature/context-adapter-foundation` scope.
4. Browser task remains `waiting` until context + run-history complete and verifier wave starts.

## Codex Outsource Queue (2026-02-17)

1. Active: `c5f554ea-2059-40d2-9fb2-bf522a590cae` (run-history persistence) — replacement implementor executing.
2. Active: `302fcffa-863d-4d90-b017-08369fad3f73` (context adapter) — implementor executing in isolated branch.
3. Waiting: `22770f24-a79b-4d14-9add-14ffd1447b2f` (browser preview) — resumes after context/run-history are complete and verifier starts.
4. Ready to outsource now: `e1ea609a-a0d0-4025-92ea-f20564110a9d` (changes tab diff/staging) — independent PR candidate from updated `main`.
5. Sequence after changes tab: `10a48d6c-9fd1-452f-aa99-3120bf23641c` (GitHub PR workflow).

## Wave 1 Status Refresh (2026-02-17)

1. `c5f554ea-2059-40d2-9fb2-bf522a590cae` now has implementation artifacts (commit `4d388ce411b3dc2b6df4591e47e67e944e7715a6`, branch `feature/run-history-persistence-fix`, required tests/typecheck pass) and is moved to `review_required`.
2. `302fcffa-863d-4d90-b017-08369fad3f73` is `review_required`; coordinator requested explicit commit/push evidence before verifier handoff.
3. `22770f24-a79b-4d14-9add-14ffd1447b2f` remains `waiting` until cross-task shared-state sequencing is verified.
4. Stale original run-history agent remains standdown-only; replacement owner output is authoritative.

## Wave 1 Verification Start (2026-02-17)

1. Verifier wave started for run-history task `c5f554ea-2059-40d2-9fb2-bf522a590cae` via verifier agent `agent-40059ba1-1b38-4d89-967a-90d02f63db38`.
2. Context task `302fcffa-863d-4d90-b017-08369fad3f73` is awaiting final commit/push artifact append before verifier dispatch.
3. Browser task remains waiting until run-history/context verification results are in.
## Outsource Candidates And Handoffs (2026-02-17)
1. Candidate `22770f24-a79b-4d14-9add-14ffd1447b2f` (in-app browser preview)
Handoff: implement browser panel + nav controls; verify with `pnpm test -- browser` and localhost manual checks.
2. Candidate `302fcffa-863d-4d90-b017-08369fad3f73` (context adapter foundation)
Handoff: deliver adapter interface + filesystem provider wiring; verify with `pnpm test -- context` and orchestrator context smoke test.
3. Candidate `e1ea609a-a0d0-4025-92ea-f20564110a9d` (changes tab diff/staging)
Handoff: deliver diff inspection + selective staging UX/state; verify with `pnpm test -- changes` and manual stage/unstage flow.
4. Dependency guard: task `10a48d6c-9fd1-452f-aa99-3120bf23641c` (GitHub PR creation) should be sequenced after changes-tab completion.
## Goal (Git Stability Incident)
Restore reliable Git operations for all sessions in this repository before any more feature work continues.

## Tasks (Git Stability Incident)
- [x] [Stabilize shared git metadata and worktree integrity](intent://local/task/d3423f2c-a203-416c-804e-b10eeb6ea728)

- [x] [Add repository guardrails to prevent artifact contamination](intent://local/task/8de93595-feab-415f-9b77-731a6ac57abc)

- [x] [Standardize push reliability workflow for agents](intent://local/task/68682ec1-e8c8-4178-a8aa-760ad433e4a5)

- [x] [Independent verification and incident closeout](intent://local/task/757390f8-04c5-43e3-ab2d-5afdeae844ab)

## Acceptance Criteria (Git Stability Incident)
1. Repository metadata integrity checks pass without invalid refs or garbage warnings.
2. Agents can publish scoped branches without recurring push/pack failures under the canonical workflow.
3. Guardrails prevent reintroduction of transient/cache/binary artifact pollution.
4. Independent verifier issues explicit GO before feature work resumes.

## Non-goals (Git Stability Incident)
1. Completing remaining Wave 2.1 feature remediation while incident status is open.
2. Rewriting the entire repository history.
3. Introducing broad CI/platform architecture changes unrelated to Git stability.

## Assumptions (Git Stability Incident)
1. Temporary pause on feature work is accepted until incident closeout (confirm?).
2. Cleaning shared local `.git` metadata (including stale worktree admin entries) is permitted (confirm?).
3. Fresh-clone fallback remains acceptable when deterministic push triggers are detected.

## Verification Plan (Git Stability Incident)
1. Execute the first three tasks in one implementation wave with strict scope boundaries.
2. Run a dedicated verifier wave for independent validation and GO/NO-GO.
3. Resume feature tasks only after explicit GO is captured in `spec`.

## Rollback Plan (Git Stability Incident)
1. Keep guardrail and workflow changes in isolated commits so they can be reverted independently.
2. If a guardrail blocks valid flows, disable only the offending rule and retain metadata repairs.
3. If reliability workflow automation is unstable, fall back to manual documented steps while retaining incident controls.

---



## Incident Status (2026-02-17)

1. Incident is closed as **GO** on 2026-02-17 after independent re-verification.
2. User executed cleanup command successfully: `rmdir /Users/gannonhall/dev/kata/kata-cloud/.git/worktrees/kata-cloud/refs`.
3. Verifier rerun confirms AC1 pass: `git count-objects -vH` reports `garbage: 0` and `size-garbage: 0 bytes` with no garbage warning line.
4. `git fsck --full` has no invalid-ref errors (dangling tree notices only); `git worktree list --porcelain` matches expected active worktrees.
5. Task `d3423f2c-a203-416c-804e-b10eeb6ea728` (metadata stabilization) is complete.
6. Task `757390f8-04c5-43e3-ab2d-5afdeae844ab` (independent closeout verification) is complete with explicit **GO**.
7. Tasks `8de93595-feab-415f-9b77-731a6ac57abc` (guardrails) and `68682ec1-e8c8-4178-a8aa-760ad433e4a5` (push workflow) remain complete and accepted.
8. Feature work may resume.

## Goal (Wave 2.1 UAT Remediation)
Address UAT-discovered orchestrator reliability and UX gaps so failure behavior, run-history visibility, and draft-apply behavior are predictable and verifiable.

## Tasks (Wave 2.1 UAT Remediation)
- [x] [Fix deterministic failure-path trigger and error surfacing](intent://local/task/644a1d68-0637-428b-a714-28e25abb05d9)

- [/] [Persist and display orchestrator run history across sessions](intent://local/task/c5f554ea-2059-40d2-9fb2-bf522a590cae)

- [x] [Clarify draft-apply behavior in spec panel UX](intent://local/task/b791fa36-ae48-46a5-a7a8-d300929e1c46)

## Acceptance Criteria (Wave 2.1 UAT Remediation)
1. Failure-trigger prompts produce failed terminal run state with actionable error messaging.
2. Orchestrator run history (not latest-only) is visible and persists across restart.
3. Draft-generated vs draft-applied behavior is explicit in UI and no longer ambiguous in UAT.
4. Targeted validation commands pass for orchestrator/notes/space plus desktop typecheck.

## Non-goals (Wave 2.1 UAT Remediation)
1. Implementing real provider authentication/runtime.
2. Building Changes-tab diff/PR workflows.
3. Adding in-app browser preview.
4. Context adapter/provider integration expansion.

## Assumptions (Wave 2.1 UAT Remediation)
1. Draft application remains an explicit user action (not auto-apply) for this remediation wave (confirm?).
2. Deterministic local failure trigger remains keyword-based for UAT validation (confirm?).
3. Run-history retention may be bounded (for example latest N runs) if clearly documented.

## Verification Plan (Wave 2.1 UAT Remediation)
1. Execute each remediation task with task-level verifier GO/NO-GO before moving to the next.
2. Re-run a focused UAT subset (Cases 4 and 5 plus draft-apply clarity check) after task completion.
3. Record final remediation GO/NO-GO in `spec` with residual risks.

## Rollback Plan (Wave 2.1 UAT Remediation)
1. Keep remediation changes scoped by concern (failure-path logic, run-history view, draft UX copy/state) for selective rollback.
2. If history rendering introduces instability, temporarily revert to latest-run view while preserving persisted data.
3. If failure-trigger logic regresses normal runs, disable deterministic trigger check and restore prior run path pending fix.

---


## Goal (Wave 2.1 Orchestrator Planning Loop)
Deliver a working orchestrator flow where a user prompt can produce a spec draft, create specialist tasks, and surface delegation status in-app.

## Tasks (Wave 2.1 Orchestrator Planning Loop)
- [x] [Add orchestrator run trigger and state lifecycle](intent://local/task/2e72faa0-bfac-4bf7-928e-c9dea128bc20)

- [x] [Implement spec-draft synthesis from orchestrator runs](intent://local/task/5eda575f-6be5-4c03-a27f-ae1ca6b2b797)

- [x] [Wire specialist task delegation and execution timeline](intent://local/task/0b021e2a-b94c-4dbe-a09e-1a2d9d3b8e61)

## Acceptance Criteria (Wave 2.1 Orchestrator Planning Loop)
1. A prompt in Orchestrator view can start and complete a tracked run with explicit lifecycle states.
2. Completed runs can produce and apply a spec draft through the existing spec note pathway.
3. Orchestrator can create/delegate Implement, Verify, and Debug specialist tasks and expose status timeline updates.
4. The new flow passes targeted tests and `pnpm run desktop:typecheck`.

## Non-goals (Wave 2.1 Orchestrator Planning Loop)
1. Implementing real provider authentication/runtime.
2. Building Changes-tab diff/PR workflows.
3. Building in-app browser preview.
4. Integrating context adapter providers beyond current local flow.

## Assumptions (Wave 2.1 Orchestrator Planning Loop)
1. Implementing a deterministic local orchestrator path first is acceptable before real provider runtime work (confirm?).
2. Existing task-note/delegation plumbing from prior waves can be reused rather than replaced.
3. Current renderer-first orchestration entrypoint remains in `src/main.tsx` until later extraction (confirm?).

## Verification Plan (Wave 2.1 Orchestrator Planning Loop)
1. Run targeted suites after each task (`orchestrator`, `notes`, `space` patterns as scoped).
2. Run `pnpm run desktop:typecheck` after each wave.
3. Delegate a verifier agent for a Wave 2.1 GO/NO-GO checkpoint after implementation tasks complete.

## Rollback Plan (Wave 2.1 Orchestrator Planning Loop)
1. Keep orchestrator changes isolated to dedicated modules/state slices so rollback can be scoped.
2. Revert delegation wiring independently from spec-draft generation if timeline/delegation regressions appear.
3. If run lifecycle destabilizes app state, disable orchestrator trigger path and retain existing stable space/spec flows.

---



## Wave 2.1 Final Status (2026-02-16)

- Decision: **GO**.
- Wave 2.1 tasks are complete:
  - `2e72faa0-bfac-4bf7-928e-c9dea128bc20`
  - `5eda575f-6be5-4c03-a27f-ae1ca6b2b797`
  - `0b021e2a-b94c-4dbe-a09e-1a2d9d3b8e61`
- Parent task `55f46e5e-e243-4efc-971b-fd5cd1504a85` is complete with integrated closeout evidence.
- Wave 2.1 acceptance criteria are satisfied:
  1. Prompt-triggered run lifecycle: PASS.
  2. Spec draft synthesis/apply path: PASS.
  3. Implement/Verify/Debug delegation + timeline: PASS.
  4. Targeted validation commands passed in verifier evidence (`desktop:typecheck`, `test -- orchestrator`, `test -- notes`, `test -- space`).
- Out-of-scope guard held for Wave 2.1 (no provider auth/runtime, PR workflow, browser preview, or context adapter scope).
- Residual risk: non-blocking `ReactDOMTestUtils.act` deprecation warning noise in tests.

## UAT Plan (Wave 2.1)

Scope: validate the delivered Wave 2.1 orchestrator flow end-to-end in the desktop UI.

### Preconditions
1. App launches in dev mode.
2. You are in a workspace with the `Orchestrator` view available.
3. Existing spec note content is present (to verify non-destructive draft apply behavior).

### Test Cases
1. Happy-path run lifecycle
- Action: submit a normal orchestrator prompt.
- Expect: run record appears with deterministic lifecycle progression (`queued` -> `running` -> terminal success).

2. Spec draft generation + apply
- Action: from a successful run, apply the generated draft to spec.
- Expect: draft is visible and can be applied through the existing spec save pathway; spec content updates.

3. Delegation timeline visibility
- Action: inspect delegated tasks for the run.
- Expect: Implement/Verify/Debug task types appear with per-task status transitions and terminal states.

4. Failure-path behavior
- Action: submit a prompt designed to trigger the deterministic failure path (existing implementation uses `fail` keyword).
- Expect: run reaches failed terminal state with actionable error messaging; existing spec content is not corrupted.

5. Session persistence sanity
- Action: reopen the app/workspace after at least one successful and one failed run.
- Expect: orchestrator run history (including timeline/status) is still present.

### Result Recording
For each case, record: `PASS` or `FAIL`, observed behavior, and any blocker.

### Exit Criteria
- UAT GO: all 5 cases pass, or only non-blocking UI wording issues remain.
- UAT NO-GO: any functional break in lifecycle, draft apply, delegation timeline, or failure safety.
## Goal (Wave 1.6 Blocker Burn-down)
Make the quality-gate suite pass locally and in CI by removing current typecheck failures and lifting enforced coverage results to the configured thresholds.

## Tasks (Wave 1.6 Blocker Burn-down)

- [x] [Resolve JSX namespace compiler failures](intent://local/task/5b77a62f-6498-4828-824d-2125eb190d7b)

- [x] [Fix GitCli mock typing mismatches in tests](intent://local/task/2e038cd9-c58e-4aed-a0c4-9ad74f812d01)

- [x] [Define enforceable coverage scope and command path](intent://local/task/60b297b2-5822-4b44-8d0e-d19423d31e1e)

- [x] [Raise global coverage metrics to passing thresholds](intent://local/task/37ba3a25-ba14-415c-b029-a9c1bc73f2fe)

- [x] [Re-run Wave 1.6 gate and issue GO/NO-GO](intent://local/task/1665fe08-0270-4fd0-b48a-f33372a3970b)

## Acceptance Criteria (Wave 1.6 Blocker Burn-down)
1. `pnpm run desktop:typecheck` exits `0` with no `TS2503` or `TS2739` failures.
2. `pnpm run test --coverage` exits `0` with thresholds enforced at `80/70/80/80`.
3. CI workflow command path remains aligned to local gates (`lint`, `desktop:typecheck`, `test --coverage`).
4. Final verification note records an explicit GO/NO-GO and severity-ranked residual risks.

## Non-goals (Wave 1.6 Blocker Burn-down)
1. Changing quality-gate thresholds.
2. Reworking CI/Dependabot architecture beyond required alignment updates.
3. Shipping unrelated product features.

## Assumptions (Wave 1.6 Blocker Burn-down)
1. Coverage thresholds remain fixed at `statements 80`, `branches 70`, `functions 80`, `lines 80`.
2. Refining coverage include/exclude to represent intended production code surface is acceptable if documented and justified.
3. Small non-behavioral exports or test seams may be added where necessary to enable deterministic tests.

## Verification Plan (Wave 1.6 Blocker Burn-down)
1. Execute Wave A tasks (typecheck blockers), then run `pnpm run desktop:typecheck`.
2. Execute Wave B tasks (coverage scope + tests), then run `pnpm run test --coverage`.
3. Run full quality-gate sweep: `pnpm install`, `pnpm run lint`, `pnpm run desktop:typecheck`, `pnpm run test --coverage`.

## Rollback Plan (Wave 1.6 Blocker Burn-down)
1. Revert Wave 1.6 typecheck-related commits if renderer typing changes introduce regressions.
2. Revert coverage scope/test commits if gate behavior diverges from intended policy.
3. Keep remediation commits scoped by task so individual rollback is possible without undoing unrelated quality-gate infrastructure.

---




## Wave 1.6 Final Status (2026-02-16)

- Decision: **GO**.
- Final verification task `1665fe08-0270-4fd0-b48a-f33372a3970b` is complete with all required gate commands passing (`pnpm install`, `pnpm run lint`, `pnpm run desktop:typecheck`, `pnpm run test --coverage`).
- Coverage thresholds remain enforced at `80/70/80/80` and pass (`80.91/74.25/84.67/80.91`).
- Coverage artifact hygiene check is clean (`NO_COVERAGE_ENTRIES`).
- Residual risk: non-blocking warning/deprecation noise only (`react-refresh/only-export-components`, `ReactDOMTestUtils.act`).
## Goal (Wave 1.5 Quality Gates)
Establish enforceable quality gates for linting, coverage, GitHub CI on pull requests/merges, and automated dependency update hygiene with Dependabot.

## Tasks (Wave 1.5 Quality Gates)
- [x] [Add linting baseline and scripts](intent://local/task/104a4249-6976-4de2-9708-f5ab4283ef58)

- [x] [Add coverage targets and enforcement](intent://local/task/b5b5509f-53b0-46b8-93aa-53e65fd88711)

- [x] [Add GitHub CI workflow for pull requests and merges](intent://local/task/f8b34c69-c337-46c0-8ba6-61bf84260c82)

- [x] [Configure Dependabot for npm and GitHub Actions](intent://local/task/58da8198-b6d5-4ef6-8f3c-715273e001f3)

- [x] [Verify quality gates end-to-end and issue GO/NO-GO](intent://local/task/e7be8fb9-0d21-4a8b-9cfd-0ad2686a3f77)

## Acceptance Criteria (Wave 1.5 Quality Gates)
1. Lint checks are standardized and runnable locally and in CI.
2. Coverage thresholds are explicit, enforced, and visible in CI outcomes.
3. GitHub CI runs on pull requests and merge-branch pushes with blocking quality gates.
4. Dependabot is configured for npm and GitHub Actions update automation.
5. Final verification provides an explicit GO/NO-GO with blocker severity.

## Non-goals (Wave 1.5 Quality Gates)
1. Refactoring product features unrelated to quality-gate enablement.
2. Introducing deployment/release automation beyond CI validation.
3. Replacing package manager or test framework.

## Assumptions (Wave 1.5 Quality Gates)
1. Coverage policy baseline is `80%` for statements/functions/lines and `70%` for branches.
2. CI runs on `pull_request` and `push` to `main`.
3. Dependabot cadence is weekly for both npm and GitHub Actions.

## Verification Plan (Wave 1.5 Quality Gates)
1. Run all local quality-gate commands after implementation.
2. Validate CI workflow trigger paths for PR and merge events.
3. Confirm Dependabot config parses and targets both ecosystems.

## Rollback Plan (Wave 1.5 Quality Gates)
1. Revert quality-gate config files and scripts in one scoped rollback commit if pipeline disruption occurs.
2. Temporarily relax threshold values (not disable entire checks) only with explicit follow-up task.
3. Keep CI workflow changes isolated so they can be reverted without affecting product code.


## Goal
Deliver a local-first Kata Cloud MVP desktop app where a user can create a Space, generate and edit a living Spec, run specialist agents on scoped tasks, review resulting code diffs, and create a GitHub pull request without leaving the app.


## Tasks (Wave 1 Remediation)
1. [Integrate task-block conversion into spec save/autosave](intent://local/task/2c119395-f7be-4595-8e2a-98cb9d976e62)
2. [Enforce one-block-one-task for duplicate titles and normalize parser module boundary](intent://local/task/e420a91b-5bab-4df8-8074-b518a04edc46)
3. [Re-run Wave 1 gate verification in network-enabled environment](intent://local/task/5c1f7d87-7581-42ed-bcce-83373e83f406)

## Acceptance Criteria (Wave 1 Remediation)
1. Spec autosave/save converts `@@@task` blocks into stable task links end-to-end.
2. Duplicate `@@@task` titles produce distinct task records with no collapsing.
3. Wave 1 verification evidence is re-run in a network-enabled environment and includes an explicit GO/NO-GO decision.

## Verification Plan (Wave 1 Remediation)
1. `pnpm run test -- notes`
2. `pnpm run test -- task-parser`
3. `pnpm install`
4. `pnpm run test -- space`
5. `pnpm run test -- git`
6. `pnpm run dev` plus manual restart persistence check.

## Wave 1 Gate Status (2026-02-16)
- Decision: **NO-GO** for Wave 2.
- Wave 1.1 fixes are verified: `pnpm run test -- space`, `pnpm run test -- git`, `pnpm run test -- notes`, and `pnpm run test -- task-parser` all pass.
- Previous blockers are resolved: no `TS2783` in git service compile path, and no empty `.node.test.ts` suite failures in scoped Vitest runs.
- Runtime remediation task `fe99cd34-6c78-45e5-b3b2-a60cebae3faf` is finalized as `review_required` with evidence.
- `Electron failed to install correctly` is resolved as the active failure signature.
- Remaining blocker signature: `pnpm run dev` aborts Electron launch with `SIGABRT` before full app startup (sandboxed runs also showed local port `5173` contention).
- Install path verification passed (`pnpm install` succeeded), but restart persistence smoke remains unverified because app boot is still blocked.
- Wave 1.2 verifier rerun task `87853fc8-3e92-428e-95da-239cbb11d698` is complete with explicit **NO-GO**.
- Gate rerun evidence: `pnpm install` and scoped tests are green, but `pnpm run dev` still fails with Electron `SIGABRT`, so restart persistence smoke remains blocked.
- Additional risk: `pnpm run dev` may exit with code `0` despite logged Electron `SIGABRT`, which can mask startup failure in automation.
- Wave 1.4 Task 1 `d9a13fa0-1e1a-487b-81e7-e0e41fa9c948` is complete with deterministic startup orchestration evidence.
- Wave 1.4 Task 2 `5287cd3d-7fba-460b-9011-d8a3b3a941d7` (gate verifier rerun) is complete with explicit **NO-GO**.
- Wave 1.3 Task 1 (`a0439035-0bda-47ac-a0dd-10c85ec82c04`) is complete; `.pnpm-store` tracked cache entries are cleared.
- Post-abort read-only recheck reconfirms Task 1 clean state: both target cache index paths are untracked and `.pnpm-store` status/diff filters are empty.
- Wave 1.3 Task 2 (`99ae8f09-0c3b-49d6-b57f-d4007df74c33`) is complete; branch hygiene and scope preservation evidence recorded.
- Wave 1.5 quality-gates implementation and verification are complete with explicit **NO-GO**.
- Wave 1.5 verifier finding: CI and Dependabot configuration is correct; remaining P0 blockers are baseline `pnpm run desktop:typecheck` and `pnpm run test --coverage` failures (code/test debt, not configuration defects).
- Coverage task exception approved: minimal additive `package.json` devDependency (`@vitest/coverage-v8`) is allowed to enable coverage execution.



## Tasks (Wave 1.1 Fixes)

- [x] [Fix git compile blocker in space git service](intent://local/task/bd898a9d-c7b0-497e-af4b-3860510eddfb)

- [x] [Normalize node-only tests in Vitest runs](intent://local/task/b9a5054a-0bfd-4eca-a825-7ba06f88e504)

- [x] [Re-run Wave 1 gate after fixes](intent://local/task/42932726-7b8d-47a5-9ccd-fcc4aba54dcd)

## Tasks (Wave 1.2 Runtime Remediation)

- [x] [Unblock Electron runtime install for dev startup](intent://local/task/fe99cd34-6c78-45e5-b3b2-a60cebae3faf)

- [x] [Re-run Wave 1 gate after runtime remediation](intent://local/task/87853fc8-3e92-428e-95da-239cbb11d698)

## Tasks (Wave 1.3 Git Hygiene)

- [x] [Clean cache artifacts from tracking and harden ignore rules](intent://local/task/a0439035-0bda-47ac-a0dd-10c85ec82c04)

- [x] [Reconcile branch hygiene and preserve runtime remediation scope](intent://local/task/99ae8f09-0c3b-49d6-b57f-d4007df74c33)

## Tasks (Wave 1.4 Runtime Launch Stabilization)

- [x] [Stabilize Electron dev startup orchestration](intent://local/task/d9a13fa0-1e1a-487b-81e7-e0e41fa9c948)

- [x] [Re-run Wave 1 gate after startup stabilization](intent://local/task/5287cd3d-7fba-460b-9011-d8a3b3a941d7)

## Acceptance Criteria (Wave 1.4 Runtime Launch Stabilization)
1. Local dev startup sequence no longer relies on stale fixed-port assumptions between Vite and Electron.
2. Runtime launch path is deterministic and documented with reproducible evidence.
3. Final Wave gate rerun provides explicit GO/NO-GO after startup-stabilization changes.

## Verification Plan (Wave 1.4 Runtime Launch Stabilization)
1. Run startup stabilization verification from task `d9a13fa0-1e1a-487b-81e7-e0e41fa9c948`.
2. Run full gate verification from task `5287cd3d-7fba-460b-9011-d8a3b3a941d7`.
3. Confirm restart persistence smoke is executed or explicitly blocked with rationale.
## Tasks
- [x] [Bootstrap desktop shell and workspace state](intent://local/task/8d3f4ea7-dd9e-4d22-b07e-d488cfff543f)

- [x] [Implement space creation and metadata management](intent://local/task/bcbfcb3d-2dff-4387-9556-35a1073a9857)

- [x] [Add git branch and worktree lifecycle for spaces](intent://local/task/c1601911-e9e8-4633-9a6e-3e401de35935)

- [x] [Build spec note panel with autosave and comment threads](intent://local/task/43a5ba09-1e2b-43db-b354-4d90a46f1cdf)

- [x] [Implement task block parsing and task-note conversion](intent://local/task/91331c4e-10c7-42cd-97be-7c63b6edfc35)


- [x] [Ship orchestrator planning loop and specialist task delegation](intent://local/task/55f46e5e-e243-4efc-971b-fd5cd1504a85)

- [ ] [Build changes tab with diff inspection and selective staging](intent://local/task/e1ea609a-a0d0-4025-92ea-f20564110a9d)

- [ ] [Add GitHub PR creation workflow in Changes tab](intent://local/task/10a48d6c-9fd1-452f-aa99-3120bf23641c)

- [/] [Add in-app browser preview for local development](intent://local/task/22770f24-a79b-4d14-9add-14ffd1447b2f)

- [/] [Integrate context engine adapter and initial providers](intent://local/task/302fcffa-863d-4d90-b017-08369fad3f73)


- [ ] [Implement real model provider runtime and authentication](intent://local/task/dfb65dc8-1eb9-47f1-b95f-e22c99005ddb)
## Acceptance Criteria
1. A user can install and run the app, create a space, and reopen it later with full state restored.
2. Each space can be linked to an isolated git branch/worktree and display branch status in the UI.
3. The spec is editable with autosave, persistent comments, and task blocks converted to task records.
4. Running the orchestrator from a user prompt creates/updates spec content and delegates specialist tasks.
5. The user can review diffs, selectively stage files, generate suggested PR content, and create a GitHub PR directly from the app.
6. The app provides an in-app browser preview for localhost development targets.
7. Orchestrator and specialists retrieve context through a pluggable context adapter interface.
8. Anthropic and OpenAI run with real model integrations supporting both API-key and token-authenticated modes.

## Non-goals
- Production authentication, billing, licensing, or multi-tenant cloud backend.
- Full marketplace for custom specialists.
- Full CI/CD orchestration or deployment management from within the app.
- Large-scale distributed indexing or enterprise ingestion pipelines.

## Assumptions
- Initial release target is macOS desktop only for v1; Linux/Windows are deferred.
- V1 desktop shell will use Electron + TypeScript with a canonical React/Vite renderer surface, keeping clean boundaries for a possible future Tauri migration.
- First milestone remains local-first with no in-app account system; provider auth uses API keys and/or token-authenticated provider sessions.
- Existing Kata Agents and Kata Orchestrator codebases may be reused as references, not direct hard dependencies.
- Wave 1 accepts additive integration points introduced during parallel execution (including `src/main.tsx`/`src/styles.css` renderer composition and optional `SpaceRecord.gitStatus` coupling in shared state); boundary cleanup is deferred unless verifier findings require a targeted refactor.

## Verification Plan
1. Run unit/integration test suites for spaces, git, notes/task parsing, orchestrator, provider integrations/auth, changes, browser, GitHub PR workflow, and context adapter.
2. Run full app build and smoke test end-to-end user journey: create space -> spec/tasks -> delegate -> inspect changes -> create PR.
3. Perform manual regression on app restart/resume to confirm persistence and resumable session behavior.

## Rollback Plan
1. Keep each feature behind scoped feature flags where feasible (space-git, orchestrator, provider-auth, changes-tab, github-pr, browser, context-adapter).
2. If a feature introduces instability, disable the corresponding flag and ship the remaining stable MVP path.
3. For migration-sensitive data changes, include reversible schema migrations and backup/restore for local app data.

## UAT Results (Wave 2.1)

### Case 1: Happy-path run lifecycle
- Result: **PASS**
- Evidence (user screenshot, 2026-02-16):
  - Run reached terminal success (`Run ... is completed`).
  - Lifecycle shows expected progression: `queued -> running -> completed`.
  - Delegated task timelines for implement/verify/debug all reached `completed` with full transition chains.
  - Draft generation state present: `Draft: ready for run ...`.

### Case 2: Spec draft generation + apply
- Result: **PASS**
- Evidence (user screenshot, 2026-02-16 4:07 PM):
  - `Orchestrator Draft` card present for run `run-5e2f539d-44b2-476d-9fe7-a0d4577f3fe7`.
  - Apply action succeeded (`Applied draft from run ...`).
  - Spec Markdown/Preview panes show updated draft-derived content.
  - Orchestrator status panel includes `Draft applied at ...` timestamp.

### Case 3: Delegation timeline visibility
- Result: **PASS**
- Evidence (same UAT screenshots):
  - Delegated task rows for `implement`, `verify`, and `debug` are visible.
  - Each row shows explicit transition chain with terminal `completed` state.
  - Run-level lifecycle and per-task timeline information are both rendered together.

### Case 4: Failure-path behavior
- Result: **FAIL**
- Evidence (user screenshot, 2026-02-16 4:10 PM):
  - Prompt contains `fail` (`"fail to a short implementation plan for improving note search"`).
  - Run still reached terminal success (`completed`) with lifecycle `queued -> running -> completed`.
  - Delegated tasks all completed; no failure message surfaced.
- Interpretation: deterministic failure-path trigger did not activate as expected in UAT.
- Impact: Wave 2.1 UAT cannot be marked GO yet; requires remediation or clarified failure-trigger contract.

### Case 5: Session persistence sanity
- Result: **PARTIAL / FAIL**
- PASS: latest orchestrator run state persists across app restart.
- FAIL: historical run timeline/history is not visible after restart; only the latest state is visible.

### Additional UAT Observation
- Submitting new prompts with `Run Orchestrator` does not automatically change `Spec Markdown`; content remains from the last applied draft.
- Current Wave 2.1 behavior appears to require explicit `Apply Draft to Spec` for spec mutation. If automatic spec refresh per run is desired, that is a follow-up UX/behavior change request.

### UAT Status (Wave 2.1)
- Current UAT decision: **NO-GO** pending remediation for:
  1. Case 4 failure-path trigger did not produce failed terminal state/error messaging.
  2. Case 5 run-history/timeline persistence gap (latest-only visibility).

## Context Adapter Closure Check (2026-02-17)

Task `302fcffa-863d-4d90-b017-08369fad3f73` is **NO-GO** for verifier wave. Closure audit found missing commit/push evidence and no remote head for `feature/context-adapter-foundation`; current branch state shows uncommitted context files. Recommended status remains `in_progress` until commit/push/remote-ref and test-output artifacts are attached in the task note.


## Context Artifact Unblocked (2026-02-17)

1. Context adapter branch `feature/context-adapter-foundation` is now committed and pushed.
2. Commit: `ac97a5cf0ccc0191e3d45453a319cbeb268664c8`.
3. Remote ref confirmed: `ac97a5cf0ccc0191e3d45453a319cbeb268664c8 refs/heads/feature/context-adapter-foundation`.
4. Verification rerun passed: `pnpm run test -- context` and `pnpm run desktop:typecheck`.
5. This clears the previous commit/push/remote-ref blocker for task `302fcffa-863d-4d90-b017-08369fad3f73`; next required step is verifier closeout.
## Browser Sequencing Decision (2026-02-17)

1. Browser task `22770f24-a79b-4d14-9add-14ffd1447b2f` remains `waiting`.
2. Required prerequisite state before resume:
   - Run-history closure task `374e17d5-6ac8-42ff-b943-66026957a892` is terminally closed with explicit GO/NO-GO.
   - Context task `302fcffa-863d-4d90-b017-08369fad3f73` has commit/push/remote-ref/test-output artifacts and is no longer closure-blocked.
3. Single next action: execute the run-history/context closure gates first, then resume browser task only after both prerequisites are satisfied.

## Run-history Closure Check (2026-02-17)

1. Closure audit for run-history task `c5f554ea-2059-40d2-9fb2-bf522a590cae` is **NO-GO**.
2. Current evidence confirms remote branch head exists (`feature/run-history-persistence-fix` -> `4d388ce411b3dc2b6df4591e47e67e944e7715a6`) and task note includes automated test/typecheck claims.
3. Blocking gaps remain: missing explicit verifier closeout record, missing manual restart persistence proof, and no independent commit-content inspection captured in this closure pass.
4. Required next actions: verifier closeout + manual restart artifact + inspectable commit artifact, then re-run closure check.
