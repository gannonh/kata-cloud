import type { OrchestratorRunViewModel } from "../../shared/orchestrator-run-view-model.js";
import type {
  CoordinatorChatEntry,
  CoordinatorShellViewModel,
  CoordinatorSidebarAgent,
  CoordinatorSidebarContextItem,
  CoordinatorWorkflowStep,
  ProjectCoordinatorShellViewModelInput
} from "./types.js";
import { toStatusToneFromRunStatus, toStatusToneFromTaskStatus } from "./types.js";

const DEFAULT_SPEC_MARKDOWN = "## Goal\nDescribe the project outcome.\n\n## Tasks\n- [ ] Add initial tasks";

function toTimestampLabel(value: Date, now: Date): string {
  const diffMs = now.getTime() - value.getTime();
  if (diffMs < 60_000) {
    return "Just now";
  }

  return value.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function toMessageLineCount(prompt: string): number {
  const normalized = prompt.replace(/\r\n/g, "\n");
  if (normalized.trim().length === 0) {
    return 0;
  }

  return normalized.split("\n").length;
}

function toSpecReady(specContent: string): boolean {
  return specContent.trim().length > 0 && specContent.trim() !== DEFAULT_SPEC_MARKDOWN;
}

function toLatestEntries(
  input: ProjectCoordinatorShellViewModelInput,
  now: Date
): CoordinatorChatEntry[] {
  const { latestRunRecord, latestRunViewModel } = input;
  if (!latestRunRecord || !latestRunViewModel) {
    return [];
  }

  const updatedAt = new Date(latestRunRecord.updatedAt);
  const promptLineCount = toMessageLineCount(latestRunRecord.prompt);
  const contextChips =
    latestRunRecord.contextSnippets?.slice(0, 2).map((snippet, index) => ({
      id: `${latestRunRecord.id}-chip-${index + 1}`,
      label: snippet.path.split("/").filter(Boolean).slice(-1)[0] ?? snippet.path
    })) ?? [];

  return [
    {
      id: `${latestRunRecord.id}-prompt`,
      role: "user",
      authorLabel: input.activeSession?.label ?? "You",
      timestampLabel: toTimestampLabel(updatedAt, now),
      content: latestRunRecord.prompt,
      contextChips: [],
      pastedLineCount: promptLineCount >= 8 ? promptLineCount : undefined
    },
    {
      id: `${latestRunRecord.id}-status`,
      role: "coordinator",
      authorLabel: "Coordinator",
      timestampLabel: toTimestampLabel(updatedAt, now),
      content: `Run ${latestRunViewModel.id} is ${latestRunViewModel.statusLabel}.\nLifecycle: ${latestRunViewModel.lifecycleText}`,
      status: {
        label:
          latestRunViewModel.status === "running" || latestRunViewModel.status === "queued"
            ? "Thinking"
            : "Stopped",
        tone: toStatusToneFromRunStatus(latestRunViewModel.status)
      },
      contextChips,
      modelLabel: latestRunViewModel.providerExecution
        ? `${latestRunViewModel.providerExecution.providerId} / ${latestRunViewModel.providerExecution.modelId}`
        : undefined
    }
  ];
}

function toHistoricalEntries(
  priorRunHistoryViewModels: OrchestratorRunViewModel[],
  now: Date
): CoordinatorChatEntry[] {
  return priorRunHistoryViewModels.map((run) => {
    const updatedAt = new Date(run.id.split("run-")[1] ?? now.toISOString());
    return {
      id: `${run.id}-history`,
      role: "system",
      authorLabel: "Run History",
      timestampLabel: Number.isNaN(updatedAt.getTime())
        ? "Earlier"
        : toTimestampLabel(updatedAt, now),
      content: `Run ${run.id} is ${run.statusLabel}.\nLifecycle: ${run.lifecycleText}`,
      contextChips: []
    };
  });
}

function toSidebarAgents(input: ProjectCoordinatorShellViewModelInput): CoordinatorSidebarAgent[] {
  const latestRunStatus = input.latestRunViewModel?.status ?? "none";
  const latestPrompt = input.latestRunViewModel?.prompt ?? "Waiting for your first prompt.";
  const baseAgent: CoordinatorSidebarAgent = {
    id: "coordinator",
    name: "Coordinator",
    summary: latestPrompt,
    taskCount: input.latestRunViewModel?.delegatedTasks.length ?? 0,
    status: toStatusToneFromRunStatus(latestRunStatus)
  };

  const delegatedAgents =
    input.latestRunViewModel?.delegatedTasks.map((task) => ({
      id: task.id,
      name: task.specialist,
      summary: `${task.type} task`,
      taskCount: 1,
      status: toStatusToneFromTaskStatus(task.status)
    })) ?? [];

  return [baseAgent, ...delegatedAgents];
}

function toSidebarContext(input: ProjectCoordinatorShellViewModelInput): CoordinatorSidebarContextItem[] {
  const fromSnippets =
    input.latestRunRecord?.contextSnippets?.map((snippet) => ({
      id: snippet.id,
      label: snippet.path.split("/").filter(Boolean).slice(-1)[0] ?? snippet.path,
      detail: snippet.provider
    })) ?? [];

  if (fromSnippets.length > 0) {
    return fromSnippets;
  }

  return [
    {
      id: "spec",
      label: "Spec",
      detail: toSpecReady(input.specContent) ? "Ready" : "Drafting"
    }
  ];
}

function toWorkflowSteps(input: ProjectCoordinatorShellViewModelInput): CoordinatorWorkflowStep[] {
  const latestStatus = input.latestRunViewModel?.status ?? "none";
  const hasDelegatedTasks = (input.latestRunViewModel?.delegatedTasks.length ?? 0) > 0;
  const delegatedCompleted = Boolean(
    input.latestRunViewModel?.delegatedTasks.some((task) => task.status === "completed")
  );
  const specReady = toSpecReady(input.specContent) || Boolean(input.latestRunRecord?.draftAppliedAt);

  const creatingSpecStatus =
    latestStatus === "queued" || latestStatus === "running"
      ? "active"
      : specReady
        ? "complete"
        : "active";

  const implementStatus = hasDelegatedTasks
    ? delegatedCompleted
      ? "complete"
      : "active"
    : "pending";

  const acceptChangesStatus = latestStatus === "completed" && specReady ? "active" : "pending";

  return [
    {
      id: "creating-spec",
      title: "Creating Spec",
      description:
        "The coordinator is analyzing your codebase and prompt so you can iterate on the implementation plan.",
      status: creatingSpecStatus
    },
    {
      id: "implement",
      title: "Implement",
      description:
        "Once the plan looks right, ask the coordinator to execute implementation and verification tasks.",
      status: implementStatus
    },
    {
      id: "accept-changes",
      title: "Accept changes",
      description:
        "Review diffs in Changes, then stage, commit, and open a pull request through your preferred flow.",
      status: acceptChangesStatus
    }
  ];
}

export function projectCoordinatorShellViewModel(
  input: ProjectCoordinatorShellViewModelInput
): CoordinatorShellViewModel {
  const now = input.now ?? new Date();
  const latestRunStatus = input.latestRunViewModel?.status ?? "none";
  const shellTitle = input.activeSpace?.name ?? "Coordinator session";
  const shellSubtitle = input.activeSession?.label ?? "No active session";

  return {
    shellTitle,
    shellSubtitle,
    sidebarAgents: toSidebarAgents(input),
    sidebarContext: toSidebarContext(input),
    latestEntries: toLatestEntries(input, now),
    historicalEntries: toHistoricalEntries(input.priorRunHistoryViewModels, now),
    workflowSteps: toWorkflowSteps(input),
    latestRunStatus
  };
}
