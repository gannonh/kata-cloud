import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoordinatorChatThread } from "./chat-thread.js";
import { CoordinatorLeftSidebar } from "./left-sidebar.js";
import { CoordinatorMessageInputBar } from "./message-input-bar.js";
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

  it("renders sidebar mode buttons as disabled placeholders", () => {
    render(
      <CoordinatorLeftSidebar
        title="Kata Cloud"
        subtitle="Session 1"
        agents={[]}
        contextItems={[]}
        collapsedSections={{ agents: false, context: false }}
        onToggleSection={() => {}}
        onCreateAgent={() => {}}
        onAddContext={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Agents" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Context" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeDisabled();
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
    // Verify the active step is flagged via aria-current and the complete step is not
    const items = screen.getAllByRole("listitem");
    const activeItems = items.filter((el) => el.getAttribute("aria-current") === "step");
    const completeItems = items.filter((el) => el.classList.contains("is-complete"));
    expect(activeItems).toHaveLength(1);
    expect(completeItems).toHaveLength(1);
  });

  it("renders message input bar with accessible textarea and model label", () => {
    render(
      <CoordinatorMessageInputBar
        prompt=""
        modelLabel="openai / gpt-4o"
        disabled={false}
        onPromptChange={() => {}}
        onSubmitPrompt={() => {}}
      />
    );

    expect(screen.getByRole("textbox", { name: "Prompt" })).toBeInTheDocument();
    expect(screen.getByText("openai / gpt-4o")).toBeInTheDocument();
  });

  it("does not call onSubmitPrompt when message input bar is disabled", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();

    render(
      <CoordinatorMessageInputBar
        prompt="hello"
        modelLabel="openai / gpt-4o"
        disabled={true}
        onPromptChange={() => {}}
        onSubmitPrompt={onSubmitPrompt}
      />
    );

    await user.click(screen.getByRole("button", { name: "Run Coordinator" }));
    expect(onSubmitPrompt).not.toHaveBeenCalled();
  });

  it("calls onSubmitPrompt when message input bar is submitted while enabled", async () => {
    const user = userEvent.setup();
    const onSubmitPrompt = vi.fn();
    const onPromptChange = vi.fn();

    render(
      <CoordinatorMessageInputBar
        prompt="build a new feature"
        modelLabel="openai / gpt-4o"
        disabled={false}
        onPromptChange={onPromptChange}
        onSubmitPrompt={onSubmitPrompt}
      />
    );

    await user.click(screen.getByRole("button", { name: "Run Coordinator" }));
    expect(onSubmitPrompt).toHaveBeenCalledTimes(1);
  });
});
