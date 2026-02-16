import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { addCommentReply, addCommentThread, buildCommentTree, loadSpecNote, saveSpecNote } from "./store";
import type { SpecCommentTreeNode, SpecNoteDocument } from "./types";

type SpecNotePanelProps = {
  storage: Storage;
  autosaveDelayMs?: number;
  now?: () => string;
  makeId?: () => string;
};

type ReplyDraft = {
  author: string;
  body: string;
};

const EMPTY_REPLY_DRAFT: ReplyDraft = {
  author: "",
  body: ""
};

export function SpecNotePanel({ storage, autosaveDelayMs = 350, now, makeId }: SpecNotePanelProps) {
  const [note, setNote] = useState<SpecNoteDocument>(() => loadSpecNote(storage));
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const [threadAnchor, setThreadAnchor] = useState("## Goal");
  const [threadAuthor, setThreadAuthor] = useState("you");
  const [threadBody, setThreadBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, ReplyDraft>>({});

  const noteRef = useRef(note);
  const didMountRef = useRef(false);
  noteRef.current = note;

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      saveSpecNote(storage, noteRef.current);
      setAutosaveStatus("Saved");
    }, autosaveDelayMs);

    setAutosaveStatus("Saving...");
    return () => {
      window.clearTimeout(timer);
    };
  }, [autosaveDelayMs, note.content, storage]);

  useEffect(() => {
    return () => {
      saveSpecNote(storage, noteRef.current);
    };
  }, [storage]);

  const totalComments = useMemo(() => {
    return note.threads.reduce((sum, thread) => sum + thread.comments.length, 0);
  }, [note.threads]);

  const onThreadSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = addCommentThread(
      note,
      {
        anchor: threadAnchor,
        author: threadAuthor,
        body: threadBody
      },
      { now, makeId }
    );
    if (next === note) {
      return;
    }
    setNote(next);
    saveSpecNote(storage, next);
    setAutosaveStatus("Saved");
    setThreadBody("");
  };

  const submitReply = (threadId: string, parentCommentId: string) => {
    const draft = replyDrafts[parentCommentId] ?? EMPTY_REPLY_DRAFT;
    const next = addCommentReply(
      note,
      {
        threadId,
        parentCommentId,
        author: draft.author,
        body: draft.body
      },
      { now, makeId }
    );
    if (next === note) {
      return;
    }

    setNote(next);
    saveSpecNote(storage, next);
    setAutosaveStatus("Saved");
    setReplyDrafts((current) => ({
      ...current,
      [parentCommentId]: EMPTY_REPLY_DRAFT
    }));
  };

  const renderCommentTree = (threadId: string, nodes: SpecCommentTreeNode[]): JSX.Element => {
    return (
      <ul className="spec-comments__tree">
        {nodes.map((node) => {
          const draft = replyDrafts[node.id] ?? EMPTY_REPLY_DRAFT;
          return (
            <li key={node.id}>
              <article className="spec-comment">
                <header>
                  <strong>{node.author}</strong>
                  <span>{new Date(node.createdAt).toLocaleString()}</span>
                </header>
                <p>{node.body}</p>
              </article>
              <form
                className="spec-comment__reply"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitReply(threadId, node.id);
                }}
              >
                <label>
                  Reply author
                  <input
                    aria-label={`Reply author ${node.id}`}
                    value={draft.author}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReplyDrafts((current) => ({
                        ...current,
                        [node.id]: {
                          ...draft,
                          author: value
                        }
                      }));
                    }}
                  />
                </label>
                <label>
                  Reply
                  <textarea
                    aria-label={`Reply body ${node.id}`}
                    value={draft.body}
                    onChange={(event) => {
                      const value = event.target.value;
                      setReplyDrafts((current) => ({
                        ...current,
                        [node.id]: {
                          ...draft,
                          body: value
                        }
                      }));
                    }}
                  />
                </label>
                <button type="submit" className="pill-button">
                  Reply
                </button>
              </form>
              {node.children.length > 0 ? renderCommentTree(threadId, node.children) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="spec-panel">
      <header className="spec-panel__header">
        <h2>Spec Note</h2>
        <p>Markdown source of truth with autosave and threaded collaboration.</p>
      </header>

      <div className="spec-panel__meta">
        <span>{autosaveStatus}</span>
        <span>{note.threads.length} thread(s)</span>
        <span>{totalComments} comment(s)</span>
      </div>

      <label className="spec-panel__editor" htmlFor="spec-content">
        Spec Markdown
        <textarea
          id="spec-content"
          value={note.content}
          onChange={(event) => {
            const nextContent = event.target.value;
            setNote((current) => ({
              ...current,
              content: nextContent,
              updatedAt: now ? now() : new Date().toISOString()
            }));
          }}
          rows={14}
        />
      </label>

      <section className="spec-panel__preview">
        <h3>Preview</h3>
        <pre>{note.content}</pre>
      </section>

      <section className="spec-comments">
        <h3>Threads</h3>
        <form className="spec-comments__new" onSubmit={onThreadSubmit}>
          <label htmlFor="thread-anchor">
            Anchor
            <input
              id="thread-anchor"
              value={threadAnchor}
              onChange={(event) => setThreadAnchor(event.target.value)}
              placeholder="## Section heading"
            />
          </label>
          <label htmlFor="thread-author">
            Author
            <input
              id="thread-author"
              value={threadAuthor}
              onChange={(event) => setThreadAuthor(event.target.value)}
              placeholder="you"
            />
          </label>
          <label htmlFor="thread-body">
            Comment
            <textarea
              id="thread-body"
              value={threadBody}
              onChange={(event) => setThreadBody(event.target.value)}
              placeholder="Add context or decision details"
            />
          </label>
          <button type="submit" className="pill-button">
            Add thread
          </button>
        </form>

        {note.threads.length === 0 ? (
          <p className="meta">No comments yet.</p>
        ) : (
          <ul className="spec-comments__threads">
            {note.threads.map((thread) => {
              const tree = buildCommentTree(thread);
              return (
                <li key={thread.id} className="spec-comments__thread">
                  <header>
                    <strong>{thread.anchor}</strong>
                    <span>{new Date(thread.updatedAt).toLocaleString()}</span>
                  </header>
                  {renderCommentTree(thread.id, tree)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
