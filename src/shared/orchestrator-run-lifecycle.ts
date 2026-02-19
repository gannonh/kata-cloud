import type { OrchestratorRunRecord, OrchestratorRunStatus } from "./state.js";

export const ALLOWED_RUN_TRANSITIONS: Record<OrchestratorRunStatus, readonly OrchestratorRunStatus[]> = {
  queued: ["running", "interrupted"],
  running: ["completed", "failed", "interrupted"],
  completed: [],
  failed: [],
  interrupted: []
};

export interface OrchestratorRunTransitionSuccess {
  ok: true;
  run: OrchestratorRunRecord;
}

export interface OrchestratorRunTransitionFailure {
  ok: false;
  run: OrchestratorRunRecord;
  reason: string;
}

export type OrchestratorRunTransitionResult =
  | OrchestratorRunTransitionSuccess
  | OrchestratorRunTransitionFailure;

function isTerminalRunStatus(status: OrchestratorRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "interrupted";
}

function appendRunTimelineStatus(
  statusTimeline: OrchestratorRunStatus[],
  nextStatus: OrchestratorRunStatus
): OrchestratorRunStatus[] {
  return statusTimeline[statusTimeline.length - 1] === nextStatus
    ? statusTimeline
    : [...statusTimeline, nextStatus];
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
      run: {
        ...run,
        statusTimeline: timeline,
        updatedAt,
        completedAt:
          isTerminalRunStatus(nextStatus) && nextStatus !== "interrupted"
            ? updatedAt
            : run.completedAt,
        interruptedAt: nextStatus === "interrupted" ? updatedAt : run.interruptedAt,
        errorMessage: nextStatus === "failed" ? failureMessage ?? run.errorMessage : undefined
      }
    };
  }

  if (!ALLOWED_RUN_TRANSITIONS[run.status].includes(nextStatus)) {
    return {
      ok: false,
      run,
      reason: `Invalid run transition: ${run.status} -> ${nextStatus}`
    };
  }

  const timeline = appendRunTimelineStatus(run.statusTimeline, nextStatus);
  return {
    ok: true,
    run: {
      ...run,
      status: nextStatus,
      statusTimeline: timeline,
      updatedAt,
      completedAt:
        isTerminalRunStatus(nextStatus) && nextStatus !== "interrupted" ? updatedAt : undefined,
      interruptedAt: nextStatus === "interrupted" ? updatedAt : undefined,
      errorMessage: nextStatus === "failed" ? failureMessage ?? run.errorMessage : undefined
    }
  };
}
