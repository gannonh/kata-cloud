import type { OrchestratorRunRecord, OrchestratorRunStatus } from "./state";

const ALLOWED_RUN_TRANSITIONS: Record<OrchestratorRunStatus, readonly OrchestratorRunStatus[]> = {
  queued: ["running"],
  running: ["completed", "failed"],
  completed: [],
  failed: []
};

export interface OrchestratorRunTransitionSuccess {
  ok: true;
  changed: boolean;
  run: OrchestratorRunRecord;
}

export interface OrchestratorRunTransitionFailure {
  ok: false;
  changed: false;
  run: OrchestratorRunRecord;
  reason: string;
}

export type OrchestratorRunTransitionResult =
  | OrchestratorRunTransitionSuccess
  | OrchestratorRunTransitionFailure;

function isTerminalRunStatus(status: OrchestratorRunStatus): boolean {
  return status === "completed" || status === "failed";
}

function appendRunTimelineStatus(
  statusTimeline: OrchestratorRunStatus[],
  nextStatus: OrchestratorRunStatus
): OrchestratorRunStatus[] {
  return statusTimeline.includes(nextStatus) ? statusTimeline : [...statusTimeline, nextStatus];
}

export function transitionOrchestratorRunStatus(
  run: OrchestratorRunRecord,
  nextStatus: OrchestratorRunStatus,
  updatedAt: string,
  failureMessage?: string
): OrchestratorRunTransitionResult {
  if (run.status === nextStatus) {
    const timeline = appendRunTimelineStatus(run.statusTimeline, nextStatus);
    return {
      ok: true,
      changed:
        run.updatedAt !== updatedAt ||
        run.completedAt !== (isTerminalRunStatus(nextStatus) ? updatedAt : run.completedAt) ||
        run.errorMessage !== (nextStatus === "failed" ? failureMessage ?? run.errorMessage : undefined) ||
        timeline !== run.statusTimeline,
      run: {
        ...run,
        statusTimeline: timeline,
        updatedAt,
        completedAt: isTerminalRunStatus(nextStatus) ? updatedAt : run.completedAt,
        errorMessage: nextStatus === "failed" ? failureMessage ?? run.errorMessage : undefined
      }
    };
  }

  if (!ALLOWED_RUN_TRANSITIONS[run.status].includes(nextStatus)) {
    return {
      ok: false,
      changed: false,
      run,
      reason: `Invalid run transition: ${run.status} -> ${nextStatus}`
    };
  }

  const timeline = appendRunTimelineStatus(run.statusTimeline, nextStatus);
  return {
    ok: true,
    changed: true,
    run: {
      ...run,
      status: nextStatus,
      statusTimeline: timeline,
      updatedAt,
      completedAt: isTerminalRunStatus(nextStatus) ? updatedAt : undefined,
      errorMessage: nextStatus === "failed" ? failureMessage ?? run.errorMessage : undefined
    }
  };
}
