import { describe, expect, it } from "vitest";
import {
  coordinatorShellUiStateReducer,
  createInitialCoordinatorShellUiState,
  getSidebarSections,
  isSidebarSectionCollapsed
} from "./ui-state.js";

describe("coordinator shell UI reducer", () => {
  it("toggles sidebar section visibility", () => {
    const initial = createInitialCoordinatorShellUiState();
    const toggled = coordinatorShellUiStateReducer(initial, {
      type: "toggle-sidebar-section",
      sectionId: "agents"
    });

    expect(isSidebarSectionCollapsed(initial, "agents")).toBe(false);
    expect(isSidebarSectionCollapsed(toggled, "agents")).toBe(true);
    expect(isSidebarSectionCollapsed(toggled, "context")).toBe(false);
  });

  it("toggles right-panel collapse state", () => {
    const initial = createInitialCoordinatorShellUiState();
    const collapsed = coordinatorShellUiStateReducer(initial, { type: "toggle-right-panel" });
    const restored = coordinatorShellUiStateReducer(collapsed, { type: "toggle-right-panel" });

    expect(initial.isRightPanelCollapsed).toBe(false);
    expect(collapsed.isRightPanelCollapsed).toBe(true);
    expect(restored.isRightPanelCollapsed).toBe(false);
  });

  it("tracks active center tab and message expansion IDs", () => {
    const initial = createInitialCoordinatorShellUiState();
    const specTab = coordinatorShellUiStateReducer(initial, {
      type: "set-active-tab",
      tab: "spec"
    });
    const expanded = coordinatorShellUiStateReducer(specTab, {
      type: "toggle-message",
      messageId: "run-1-prompt"
    });
    const collapsed = coordinatorShellUiStateReducer(expanded, {
      type: "toggle-message",
      messageId: "run-1-prompt"
    });

    expect(specTab.activeCenterTab).toBe("spec");
    expect(expanded.expandedMessageIds).toEqual(["run-1-prompt"]);
    expect(collapsed.expandedMessageIds).toEqual([]);
  });

  it("exposes stable sidebar section identifiers", () => {
    expect(getSidebarSections()).toEqual(["agents", "context"]);
  });
});
