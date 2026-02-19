import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoordinatorChatThread } from "./chat-thread.js";
import { CoordinatorLeftSidebar } from "./left-sidebar.js";
import { CoordinatorWorkflowPanel } from "./workflow-panel.js";

describe("coordinator-shell components", () => {
  it("renders sidebar disclosures and triggers section callbacks", async () => {
    const user = userEvent.setup();
    const onToggleSection = vi.fn();
    const onCreateAgent = vi.fn();
    const onAddContext = vi.fn();

    render(
      <CoordinatorLeftSidebar
        title="Kata Cloud"
        subtitle="Session 1"
        agents={[
          {
            id: "coordinator",
            name: "Coordinator",
            summary: "Build a shell",
            taskCount: 2,
            status: "running"
          }
        ]}
        contextItems={[
          {
            id: "spec",
            label: "Spec",
            detail: "Drafting"
          }
        ]}
        collapsedSections={{ agents: false, context: false }}
        onToggleSection={onToggleSection}
        onCreateAgent={onCreateAgent}
        onAddContext={onAddContext}
      />
    );

    await user.click(screen.getByRole("button", { name: "Toggle Agents section" }));
    await user.click(screen.getByRole("button", { name: "Toggle Context section" }));
    await user.click(screen.getByRole("button", { name: "+ Create new agent" }));
    await user.click(screen.getByRole("button", { name: "+ Add context" }));

    expect(onToggleSection).toHaveBeenNthCalledWith(1, "agents");
    expect(onToggleSection).toHaveBeenNthCalledWith(2, "context");
    expect(onCreateAgent).toHaveBeenCalledTimes(1);
    expect(onAddContext).toHaveBeenCalledTimes(1);
  });

  it("renders chat entries with author/timestamp metadata and history heading", () => {
    render(
      <CoordinatorChatThread
        entries={[
          {
            id: "entry-1",
            role: "user",
            authorLabel: "Session 1",
            timestampLabel: "Just now",
            content: "Please generate a build plan.",
            contextChips: []
          }
        ]}
        historyEntries={[
          {
            id: "entry-2",
            role: "system",
            authorLabel: "Run History",
            timestampLabel: "Earlier",
            content: "Run run-1 is Failed.",
            contextChips: []
          }
        ]}
        expandedMessageIds={[]}
        onToggleMessage={() => {}}
      />
    );

    expect(screen.getByText("Session 1")).toBeInTheDocument();
    expect(screen.getByText("Just now")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Run History" })).toBeInTheDocument();
    expect(screen.getByText("Run run-1 is Failed.")).toBeInTheDocument();
  });

  it("renders workflow step statuses for active and complete states", () => {
    render(
      <CoordinatorWorkflowPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        steps={[
          {
            id: "creating-spec",
            title: "Creating Spec",
            description: "Generate the initial spec draft.",
            status: "active"
          },
          {
            id: "implement",
            title: "Implement",
            description: "Run implementation tasks.",
            status: "pending"
          },
          {
            id: "accept-changes",
            title: "Accept changes",
            description: "Review and merge.",
            status: "complete"
          }
        ]}
      />
    );

    expect(screen.getByText("Creating Spec")).toBeInTheDocument();
    expect(screen.getByText("Implement")).toBeInTheDocument();
    expect(screen.getByText("Accept changes")).toBeInTheDocument();
    expect(document.querySelectorAll(".coordinator-workflow__step.is-active")).toHaveLength(1);
    expect(document.querySelectorAll(".coordinator-workflow__step.is-complete")).toHaveLength(1);
  });
});
