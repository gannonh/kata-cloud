import type {
  OrchestratorDelegatedTaskRecord,
  OrchestratorTaskStatus,
  OrchestratorTaskType
} from "./state";

export const ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE: Record<OrchestratorTaskType, string> = {
  implement: "implementor",
  verify: "verifier",
  debug: "developer"
};

const TASK_TYPES: OrchestratorTaskType[] = ["implement", "verify", "debug"];

function createTaskRecord(
  runId: string,
  type: OrchestratorTaskType,
  createdAt: string
): OrchestratorDelegatedTaskRecord {
  return {
    id: `${runId}-${type}`,
    runId,
    type,
    specialist: ORCHESTRATOR_SPECIALIST_BY_TASK_TYPE[type],
    status: "queued",
    statusTimeline: ["queued"],
    createdAt,
    updatedAt: createdAt
  };
}

function appendTaskStatus(
  task: OrchestratorDelegatedTaskRecord,
  status: OrchestratorTaskStatus,
  updatedAt: string,
  errorMessage?: string
): OrchestratorDelegatedTaskRecord {
  return {
    ...task,
    status,
    statusTimeline: task.statusTimeline.includes(status) ? task.statusTimeline : [...task.statusTimeline, status],
    updatedAt,
    completedAt: status === "completed" || status === "failed" ? updatedAt : task.completedAt,
    errorMessage: status === "failed" ? errorMessage ?? task.errorMessage : undefined
  };
}

function resolveDelegationFailure(taskType: OrchestratorTaskType, prompt: string): string | null {
  const normalizedPrompt = prompt.trim().toLowerCase();
  if (!normalizedPrompt.includes("delegate-fail")) {
    return null;
  }

  if (normalizedPrompt.includes(taskType)) {
    return `Delegation failed for ${taskType}. Retry with a narrower ${taskType} scope and rerun.`;
  }

  if (taskType === "verify") {
    return "Delegation failed for verify. Retry with a narrower verify scope and rerun.";
  }

  return null;
}

export function buildDelegatedTaskTimeline(
  runId: string,
  prompt: string,
  timestamp: string
): {
  tasks: OrchestratorDelegatedTaskRecord[];
  failureMessage?: string;
} {
  const tasks: OrchestratorDelegatedTaskRecord[] = [];
  let blockingFailure: string | null = null;

  for (const taskType of TASK_TYPES) {
    let task = createTaskRecord(runId, taskType, timestamp);
    task = appendTaskStatus(task, "delegating", timestamp);

    if (blockingFailure) {
      task = appendTaskStatus(
        task,
        "failed",
        timestamp,
        `Skipped because an earlier delegation failed: ${blockingFailure}`
      );
      tasks.push(task);
      continue;
    }

    const failureMessage = resolveDelegationFailure(taskType, prompt);
    if (failureMessage) {
      task = appendTaskStatus(task, "failed", timestamp, failureMessage);
      tasks.push(task);
      blockingFailure = failureMessage;
      continue;
    }

    task = appendTaskStatus(task, "delegated", timestamp);
    task = appendTaskStatus(task, "running", timestamp);
    task = appendTaskStatus(task, "completed", timestamp);
    tasks.push(task);
  }

  return {
    tasks,
    failureMessage: blockingFailure ?? undefined
  };
}
