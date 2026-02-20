import type React from "react";
import type {
  CoordinatorSidebarAgent,
  CoordinatorSidebarContextItem,
  CoordinatorSidebarSectionId
} from "./types.js";
import { toStatusClassName } from "./types.js";

type LeftSidebarProps = {
  title: string;
  subtitle: string;
  agents: CoordinatorSidebarAgent[];
  contextItems: CoordinatorSidebarContextItem[];
  collapsedSections: Record<CoordinatorSidebarSectionId, boolean>;
  onToggleSection: (sectionId: CoordinatorSidebarSectionId) => void;
  onCreateAgent: () => void;
  onAddContext: () => void;
};

function SectionHeader(props: {
  sectionId: CoordinatorSidebarSectionId;
  title: string;
  description: string;
  collapsed: boolean;
  onToggle: (sectionId: CoordinatorSidebarSectionId) => void;
}): React.JSX.Element {
  const { sectionId, title, description, collapsed, onToggle } = props;
  const buttonId = `coordinator-sidebar-section-${sectionId}`;
  return (
    <header className="coordinator-sidebar__section-header">
      <button
        id={buttonId}
        type="button"
        className="coordinator-sidebar__disclosure"
        aria-label={`Toggle ${title} section`}
        aria-expanded={!collapsed}
        onClick={() => onToggle(sectionId)}
      >
        <span className="coordinator-sidebar__chevron" aria-hidden="true">
          {collapsed ? "+" : "-"}
        </span>
        <span>{title}</span>
      </button>
      <p>{description}</p>
    </header>
  );
}

export function CoordinatorLeftSidebar(props: LeftSidebarProps): React.JSX.Element {
  const {
    title,
    subtitle,
    agents,
    contextItems,
    collapsedSections,
    onToggleSection,
    onCreateAgent,
    onAddContext
  } = props;

  return (
    <aside className="coordinator-sidebar">
      <header className="coordinator-sidebar__header">
        <p className="coordinator-sidebar__eyebrow">Coordinator</p>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>

      <div className="coordinator-sidebar__icon-row" aria-label="Sidebar modes">
        <button type="button" className="coordinator-sidebar__icon-button" disabled>
          Agents
        </button>
        <button type="button" className="coordinator-sidebar__icon-button" disabled>
          Context
        </button>
        <button type="button" className="coordinator-sidebar__icon-button" disabled>
          Tasks
        </button>
      </div>

      <section className="coordinator-sidebar__section">
        <SectionHeader
          sectionId="agents"
          title="Agents"
          description="Agents write code, maintain notes, and coordinate tasks."
          collapsed={collapsedSections.agents}
          onToggle={onToggleSection}
        />
        {!collapsedSections.agents ? (
          <div className="coordinator-sidebar__section-body">
            <button type="button" className="coordinator-sidebar__action-link" onClick={onCreateAgent}>
              + Create new agent
            </button>
            <ul className="coordinator-sidebar__list">
              {agents.map((agent) => (
                <li key={agent.id} className="coordinator-sidebar__agent">
                  <span className={`coordinator-sidebar__status-dot ${toStatusClassName(agent.status)}`} />
                  <div>
                    <p className="coordinator-sidebar__item-title">{agent.name}</p>
                    <p className="coordinator-sidebar__item-meta">
                      {agent.summary} {agent.taskCount > 0 ? `(${agent.taskCount} task${agent.taskCount > 1 ? "s" : ""})` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="coordinator-sidebar__section">
        <SectionHeader
          sectionId="context"
          title="Context"
          description="Context is shared with all agents on demand."
          collapsed={collapsedSections.context}
          onToggle={onToggleSection}
        />
        {!collapsedSections.context ? (
          <div className="coordinator-sidebar__section-body">
            <button type="button" className="coordinator-sidebar__action-link" onClick={onAddContext}>
              + Add context
            </button>
            <ul className="coordinator-sidebar__list">
              {contextItems.map((contextItem) => (
                <li key={contextItem.id} className="coordinator-sidebar__context">
                  <p className="coordinator-sidebar__item-title">{contextItem.label}</p>
                  <p className="coordinator-sidebar__item-meta">{contextItem.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
