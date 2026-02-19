import type { OrchestratorRunRecord } from "./state.js";

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
  return [...runsForActiveSession].sort((leftRun, rightRun) => {
    if (rightRun.updatedAt !== leftRun.updatedAt) {
      return rightRun.updatedAt < leftRun.updatedAt ? -1 : 1;
    }

    if (rightRun.createdAt !== leftRun.createdAt) {
      return rightRun.createdAt < leftRun.createdAt ? -1 : 1;
    }

    return rightRun.id.localeCompare(leftRun.id);
  });
}
