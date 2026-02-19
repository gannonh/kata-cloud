import type { ContextProviderId, ContextSnippet } from "../context/types.js";
import type {
  OrchestratorDelegatedTaskRecord,
  OrchestratorRunRecord,
  OrchestratorRunStatus,
  OrchestratorTaskStatus
} from "./state.js";

export interface OrchestratorDelegatedTaskViewModel {
  id: string;
  type: OrchestratorDelegatedTaskRecord["type"];
  specialist: string;
  status: OrchestratorDelegatedTaskRecord["status"];
  lifecycleText: string;
  errorMessage?: string;
}

export interface OrchestratorRunViewModel {
  id: string;
  prompt: string;
  status: OrchestratorRunStatus;
  statusLabel: string;
  lifecycleText: string;
  contextPreview: string;
  errorMessage?: string;
  contextDiagnostics?: {
    code: string;
    providerId: string;
    message: string;
    remediation: string;
    retryable: boolean;
  };
  providerExecution?: {
    providerId: string;
    modelId: string;
    runtimeMode: "native" | "pi";
    status: "succeeded" | "failed";
    errorCode?: string;
    remediation?: string;
    retryable?: boolean;
  };
  contextProvenance?: OrchestratorRunContextProvenance;
  delegatedTasks: OrchestratorDelegatedTaskViewModel[];
}

export interface OrchestratorRunContextProvenance {
  resolvedProviderId: ContextProviderId;
  snippetCount: number;
  fallbackFromProviderId?: ContextProviderId;
}

function toStatusLabel(status: OrchestratorRunStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "interrupted":
      return "Interrupted";
  }
}

function toTaskStatusLabel(status: OrchestratorTaskStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "delegating":
      return "Delegating";
    case "delegated":
      return "Delegated";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
  }
}

function toContextPreview(contextSnippets: ContextSnippet[] | undefined): string {
  if (!contextSnippets || contextSnippets.length === 0) {
    return "No context snippets available.";
  }

  const firstSnippet = contextSnippets[0];
  if (!firstSnippet) {
    return "No context snippets available.";
  }

  const snippetText = firstSnippet.content.trim();
  if (snippetText.length === 0) {
    return `Context from ${firstSnippet.path}`;
  }

  return `${firstSnippet.path}: ${snippetText}`;
}

function projectDelegatedTask(
  task: OrchestratorDelegatedTaskRecord
): OrchestratorDelegatedTaskViewModel {
  return {
    id: task.id,
    type: task.type,
    specialist: task.specialist,
    status: task.status,
    lifecycleText: task.statusTimeline.map(toTaskStatusLabel).join(" -> "),
    errorMessage: task.errorMessage
  };
}

export function projectOrchestratorRunViewModel(run: OrchestratorRunRecord): OrchestratorRunViewModel {
  const delegatedTasks = run.delegatedTasks?.map(projectDelegatedTask) ?? [];
  const failedTaskError = delegatedTasks.find((task) => task.status === "failed")?.errorMessage;
  // Preserve compatibility for older persisted runs that predate fallbackFromProviderId.
  const legacyFallbackFromSnippet =
    run.contextSnippets?.[0]?.provider !== run.resolvedProviderId
      ? run.contextSnippets?.[0]?.provider
      : undefined;
  const contextProvenance: OrchestratorRunContextProvenance | undefined = run.resolvedProviderId
    ? {
        resolvedProviderId: run.resolvedProviderId,
        snippetCount: run.contextSnippets?.length ?? 0,
        fallbackFromProviderId: run.fallbackFromProviderId ?? legacyFallbackFromSnippet
      }
    : undefined;

  return {
    id: run.id,
    prompt: run.prompt,
    status: run.status,
    statusLabel: toStatusLabel(run.status),
    lifecycleText: run.statusTimeline.join(" -> "),
    contextPreview: toContextPreview(run.contextSnippets),
    errorMessage: failedTaskError ?? run.errorMessage,
    contextDiagnostics: run.contextRetrievalError
      ? {
          code: run.contextRetrievalError.code,
          providerId: run.contextRetrievalError.providerId,
          message: run.contextRetrievalError.message,
          remediation: run.contextRetrievalError.remediation,
          retryable: run.contextRetrievalError.retryable
        }
      : undefined,
    providerExecution: run.providerExecution
      ? {
          providerId: run.providerExecution.providerId,
          modelId: run.providerExecution.modelId,
          runtimeMode: run.providerExecution.runtimeMode,
          status: run.providerExecution.status,
          errorCode: run.providerExecution.errorCode,
          remediation: run.providerExecution.remediation,
          retryable: run.providerExecution.retryable
        }
      : undefined,
    contextProvenance,
    delegatedTasks
  };
}

export function projectOrchestratorRunHistory(
  runs: OrchestratorRunRecord[]
): OrchestratorRunViewModel[] {
  return runs.map(projectOrchestratorRunViewModel);
}
