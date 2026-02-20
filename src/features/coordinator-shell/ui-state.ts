import type {
  CoordinatorShellUiAction,
  CoordinatorShellUiState,
  CoordinatorSidebarSectionId
} from "./types.js";

const SIDEBAR_SECTIONS: CoordinatorSidebarSectionId[] = ["agents", "context"];

export function createInitialCoordinatorShellUiState(): CoordinatorShellUiState {
  return {
    collapsedSections: {
      agents: false,
      context: false
    },
    isRightPanelCollapsed: false,
    activeRightTab: "workflow",
    expandedMessageIds: []
  };
}

export function coordinatorShellUiStateReducer(
  state: CoordinatorShellUiState,
  action: CoordinatorShellUiAction
): CoordinatorShellUiState {
  switch (action.type) {
    case "toggle-sidebar-section":
      return {
        ...state,
        collapsedSections: {
          ...state.collapsedSections,
          [action.sectionId]: !state.collapsedSections[action.sectionId]
        }
      };
    case "toggle-right-panel":
      return {
        ...state,
        isRightPanelCollapsed: !state.isRightPanelCollapsed
      };
    case "set-active-right-tab":
      if (state.activeRightTab === action.tab) {
        return state;
      }
      return {
        ...state,
        activeRightTab: action.tab
      };
    case "toggle-message": {
      const alreadyExpanded = state.expandedMessageIds.includes(action.messageId);
      return {
        ...state,
        expandedMessageIds: alreadyExpanded
          ? state.expandedMessageIds.filter((id) => id !== action.messageId)
          : [...state.expandedMessageIds, action.messageId]
      };
    }
  }
}

export function isSidebarSectionCollapsed(
  state: CoordinatorShellUiState,
  sectionId: CoordinatorSidebarSectionId
): boolean {
  return state.collapsedSections[sectionId];
}

export function getSidebarSections(): CoordinatorSidebarSectionId[] {
  return [...SIDEBAR_SECTIONS];
}
