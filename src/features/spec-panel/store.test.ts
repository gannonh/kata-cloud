import { describe, expect, it } from "vitest";
import { addCommentReply, addCommentThread, buildCommentTree, createDefaultSpecNote } from "./store.js";

describe("spec note store helpers", () => {
  it("adds thread and nested reply in deterministic order", () => {
    const base = createDefaultSpecNote(() => "2026-02-16T00:00:00.000Z");
    const withThread = addCommentThread(
      base,
      {
        anchor: "## Goal",
        author: "alice",
        body: "Root"
      },
      {
        now: () => "2026-02-16T00:00:01.000Z",
        makeId: () => "a"
      }
    );

    const withReply = addCommentReply(
      withThread,
      {
        threadId: "thread_a",
        parentCommentId: "comment_a",
        author: "bob",
        body: "Nested"
      },
      {
        now: () => "2026-02-16T00:00:02.000Z",
        makeId: () => "b"
      }
    );

    expect(withReply.threads).toHaveLength(1);
    const tree = buildCommentTree(withReply.threads[0]);
    expect(tree).toHaveLength(1);
    expect(tree[0].body).toBe("Root");
    expect(tree[0].children[0].body).toBe("Nested");
  });
});
