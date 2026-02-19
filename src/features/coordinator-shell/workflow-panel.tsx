import type React from "react";
import type { CoordinatorWorkflowStep } from "./types.js";

type WorkflowPanelProps = {
  steps: CoordinatorWorkflowStep[];
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function toStatusClassName(status: CoordinatorWorkflowStep["status"]): string {
  switch (status) {
    case "pending":
      return "is-pending";
    case "active":
      return "is-active";
    case "complete":
      return "is-complete";
  }
}

export function CoordinatorWorkflowPanel(props: WorkflowPanelProps): React.JSX.Element {
  const { steps, collapsed, onToggleCollapse } = props;

  return (
    <section className="coordinator-workflow">
      <header className="coordinator-workflow__header">
        <div>
          <p className="coordinator-workflow__eyebrow">Workflow</p>
          <h3>Guided progression</h3>
        </div>
        <button type="button" className="pill-button" onClick={onToggleCollapse}>
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </header>

      {!collapsed ? (
        <ol className="coordinator-workflow__steps">
          {steps.map((step) => (
            <li key={step.id} className={`coordinator-workflow__step ${toStatusClassName(step.status)}`}>
              <span className="coordinator-workflow__dot" />
              <div>
                <p className="coordinator-workflow__title">{step.title}</p>
                <p className="coordinator-workflow__description">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
