import type React from "react";
import type { CoordinatorChatEntry, CoordinatorShellStatusTone } from "./types.js";

type ChatThreadProps = {
  entries: CoordinatorChatEntry[];
  historyEntries: CoordinatorChatEntry[];
  expandedMessageIds: string[];
  onToggleMessage: (messageId: string) => void;
};

function toStatusClassName(status: CoordinatorShellStatusTone): string {
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

function shouldAllowCollapse(content: string): boolean {
  return content.length > 220 || content.split("\n").length > 4;
}

function toCollapsedContent(content: string): string {
  if (content.length <= 180) {
    return content;
  }
  return `${content.slice(0, 180).trimEnd()}...`;
}

function ChatEntry(props: {
  entry: CoordinatorChatEntry;
  expandedMessageIds: string[];
  onToggleMessage: (messageId: string) => void;
}): React.JSX.Element {
  const { entry, expandedMessageIds, onToggleMessage } = props;
  const canCollapse = shouldAllowCollapse(entry.content);
  const isExpanded = expandedMessageIds.includes(entry.id);

  return (
    <article className={`coordinator-thread__entry is-${entry.role}`}>
      <header className="coordinator-thread__entry-header">
        <p className="coordinator-thread__author">{entry.authorLabel}</p>
        <p className="coordinator-thread__timestamp">{entry.timestampLabel}</p>
      </header>

      <p className="coordinator-thread__content">
        {canCollapse && !isExpanded ? toCollapsedContent(entry.content) : entry.content}
      </p>

      {entry.pastedLineCount ? (
        <button
          type="button"
          className="coordinator-thread__pasted-lines"
          onClick={() => onToggleMessage(entry.id)}
        >
          Pasted {entry.pastedLineCount} lines
        </button>
      ) : null}

      {entry.contextChips.length > 0 ? (
        <ul className="coordinator-thread__chips">
          {entry.contextChips.map((chip) => (
            <li key={chip.id} className="coordinator-thread__chip">
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="coordinator-thread__entry-footer">
        {entry.modelLabel ? <span>{entry.modelLabel}</span> : null}
        {entry.status ? (
          <span className={`coordinator-thread__status ${toStatusClassName(entry.status.tone)}`}>
            {entry.status.label}
          </span>
        ) : null}
        {canCollapse ? (
          <button
            type="button"
            className="coordinator-thread__toggle"
            onClick={() => onToggleMessage(entry.id)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

export function CoordinatorChatThread(props: ChatThreadProps): React.JSX.Element {
  const { entries, historyEntries, expandedMessageIds, onToggleMessage } = props;

  return (
    <section className="coordinator-thread">
      {entries.length === 0 ? (
        <article className="coordinator-thread__empty">
          <p>Start drafting a specification for what you want to build.</p>
          <p>Or brainstorm with the coordinator.</p>
        </article>
      ) : (
        entries.map((entry) => (
          <ChatEntry
            key={entry.id}
            entry={entry}
            expandedMessageIds={expandedMessageIds}
            onToggleMessage={onToggleMessage}
          />
        ))
      )}

      {historyEntries.length > 0 ? (
        <section className="coordinator-thread__history">
          <h4>Run History</h4>
          {historyEntries.map((entry) => (
            <ChatEntry
              key={entry.id}
              entry={entry}
              expandedMessageIds={expandedMessageIds}
              onToggleMessage={onToggleMessage}
            />
          ))}
        </section>
      ) : null}
    </section>
  );
}
