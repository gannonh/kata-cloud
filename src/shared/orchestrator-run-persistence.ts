import type { ContextSnippet } from "../context/types";
import type {
  OrchestratorDelegatedTaskRecord,
  OrchestratorRunRecord,
  OrchestratorSpecDraft
} from "./state";

export interface OrchestratorRunCompletionUpdate {
  contextSnippets?: ContextSnippet[];
  draft?: OrchestratorSpecDraft;
  draftAppliedAt?: string;
  draftApplyError?: string;
  delegatedTasks?: OrchestratorDelegatedTaskRecord[];
}

function upsertRunById(
  orchestratorRuns: OrchestratorRunRecord[],
  run: OrchestratorRunRecord
): OrchestratorRunRecord[] {
  const existingIndex = orchestratorRuns.findIndex((entry) => entry.id === run.id);
  if (existingIndex === -1) {
    return [...orchestratorRuns, run];
  }

  return orchestratorRuns.map((entry) => (entry.id === run.id ? run : entry));
}

export function enqueueOrchestratorRun(
  orchestratorRuns: OrchestratorRunRecord[],
  queuedRun: OrchestratorRunRecord
): OrchestratorRunRecord[] {
  return upsertRunById(orchestratorRuns, queuedRun);
}

export function applyOrchestratorRunUpdate(
  orchestratorRuns: OrchestratorRunRecord[],
  updatedRun: OrchestratorRunRecord
): OrchestratorRunRecord[] {
  return upsertRunById(orchestratorRuns, updatedRun);
}

export function completeOrchestratorRun(
  orchestratorRuns: OrchestratorRunRecord[],
  runId: string,
  update: OrchestratorRunCompletionUpdate
): OrchestratorRunRecord[] {
  return orchestratorRuns.map((run) =>
    run.id === runId
      ? {
          ...run,
          contextSnippets: update.contextSnippets,
          draft: update.draft,
          draftAppliedAt: update.draftAppliedAt,
          draftApplyError: update.draftApplyError,
          delegatedTasks: update.delegatedTasks
        }
      : run
  );
}

