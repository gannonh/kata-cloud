import type {
  OrchestratorRunRecord,
  OrchestratorRunStatus,
  OrchestratorTaskStatus,
  SessionRecord,
  SpaceRecord
} from "../../shared/state.js";
import type { OrchestratorRunViewModel } from "../../shared/orchestrator-run-view-model.js";

export type CoordinatorSidebarSectionId = "agents" | "context";
export type CoordinatorRightTab = "workflow" | "spec";

export type CoordinatorShellStatusTone =
  | "idle"
  | "running"
  | "complete"
  | "warning"
  | "error";

export interface CoordinatorSidebarAgent {
  id: string;
  name: string;
  summary: string;
  taskCount: number;
  status: CoordinatorShellStatusTone;
}

export interface CoordinatorSidebarContextItem {
  id: string;
  label: string;
  detail: string;
}

export interface CoordinatorContextChip {
  id: string;
  label: string;
}

export interface CoordinatorChatStatus {
  label: string;
  tone: CoordinatorShellStatusTone;
}

export interface CoordinatorChatEntry {
  id: string;
  role: "user" | "coordinator" | "system";
  authorLabel: string;
  timestampLabel: string;
  content: string;
  status?: CoordinatorChatStatus;
  contextChips: CoordinatorContextChip[];
  pastedLineCount?: number;
  modelLabel?: string;
}

export type CoordinatorWorkflowStepId = "creating-spec" | "implement" | "accept-changes";
export type CoordinatorWorkflowStepStatus = "pending" | "active" | "complete";

export interface CoordinatorWorkflowStep {
  id: CoordinatorWorkflowStepId;
  title: string;
  description: string;
  status: CoordinatorWorkflowStepStatus;
}

export interface CoordinatorShellViewModel {
  shellTitle: string;
  shellSubtitle: string;
  sidebarAgents: CoordinatorSidebarAgent[];
  sidebarContext: CoordinatorSidebarContextItem[];
  latestEntries: CoordinatorChatEntry[];
  historicalEntries: CoordinatorChatEntry[];
  workflowSteps: CoordinatorWorkflowStep[];
  latestRunStatus: OrchestratorRunStatus | "none";
}

export interface ProjectCoordinatorShellViewModelInput {
  activeSpace?: SpaceRecord;
  activeSession?: SessionRecord;
  latestRunRecord?: OrchestratorRunRecord;
  latestRunViewModel?: OrchestratorRunViewModel;
  priorRunHistoryViewModels: OrchestratorRunViewModel[];
  specContent: string;
  now?: Date;
}

export interface CoordinatorShellUiState {
  collapsedSections: Record<CoordinatorSidebarSectionId, boolean>;
  isRightPanelCollapsed: boolean;
  activeRightTab: CoordinatorRightTab;
  expandedMessageIds: string[];
}

export type CoordinatorShellUiAction =
  | { type: "toggle-sidebar-section"; sectionId: CoordinatorSidebarSectionId }
  | { type: "toggle-right-panel" }
  | { type: "set-active-right-tab"; tab: CoordinatorRightTab }
  | { type: "toggle-message"; messageId: string };

export function toStatusClassName(status: CoordinatorShellStatusTone): string {
  switch (status) {
    case "idle":
      return "is-idle";
    case "running":
      return "is-running";
    case "complete":
      return "is-complete";
    case "warning":
      return "is-warning";
    case "error":
      return "is-error";
  }
}

export function toStatusToneFromTaskStatus(status: OrchestratorTaskStatus): CoordinatorShellStatusTone {
  switch (status) {
    case "queued":
      return "idle";
    case "delegating":
    case "delegated":
    case "running":
      return "running";
    case "completed":
      return "complete";
    case "failed":
      return "error";
  }
}

export function toStatusToneFromRunStatus(
  status: OrchestratorRunStatus | "none"
): CoordinatorShellStatusTone {
  switch (status) {
    case "none":
      return "idle";
    case "queued":
    case "running":
      return "running";
    case "completed":
      return "complete";
    case "failed":
      return "error";
    case "interrupted":
      return "warning";
  }
}
