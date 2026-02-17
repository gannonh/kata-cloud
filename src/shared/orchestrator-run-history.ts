import type { OrchestratorRunRecord } from "./state";

export function getRunsForActiveSession(
  orchestratorRuns: OrchestratorRunRecord[],
  activeSpaceId: string,
  activeSessionId: string
): OrchestratorRunRecord[] {
  return orchestratorRuns.filter(
    (run) => run.spaceId === activeSpaceId && run.sessionId === activeSessionId
  );
}

export function getRunHistoryForActiveSession(
  runsForActiveSession: OrchestratorRunRecord[]
): OrchestratorRunRecord[] {
  return [...runsForActiveSession].sort((leftRun, rightRun) =>
    rightRun.updatedAt < leftRun.updatedAt ? -1 : rightRun.updatedAt > leftRun.updatedAt ? 1 : 0
  );
}
