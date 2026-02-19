import { describe, expect, it } from "vitest";
import {
  SPEC_NOTE_STORAGE_KEY,
  addCommentReply,
  addCommentThread,
  buildCommentTree,
  createDefaultSpecNote,
  loadSpecNote,
  saveSpecNote
} from "./store.js";

function createMemoryStorage(seed?: Record<string, string>): Storage {
  const memory = new Map<string, string>(seed ? Object.entries(seed) : []);
  return {
    clear() {
      memory.clear();
    },
    getItem(key: string) {
      return memory.has(key) ? memory.get(key)! : null;
    },
    key(index: number) {
      return Array.from(memory.keys())[index] ?? null;
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
    },
    get length() {
      return memory.size;
    }
  };
}

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

  it("converts @@@task blocks into task links when saving", () => {
    const storage = createMemoryStorage();
    const next = saveSpecNote(storage, {
      content: ["## Tasks", "@@@task", "# Build parser", "Turn blocks into links.", "@@@"].join("\n"),
      updatedAt: "2026-02-16T00:00:00.000Z",
      threads: []
    });

    expect(next.content).toContain("intent://local/task/");
    expect(next.content).not.toContain("@@@task");

    const persisted = loadSpecNote(storage, SPEC_NOTE_STORAGE_KEY);
    expect(persisted.content).toContain("intent://local/task/");
    expect(persisted.tasks).toHaveLength(1);
  });

  it("reuses task ids when the same task block is saved repeatedly", () => {
    const storage = createMemoryStorage();
    const input = {
      content: ["## Tasks", "@@@task", "# Build parser", "Turn blocks into links.", "@@@"].join("\n"),
      updatedAt: "2026-02-16T00:00:00.000Z",
      threads: []
    };

    const first = saveSpecNote(storage, input);
    const second = saveSpecNote(storage, input);

    const firstTaskId = first.content.match(/intent:\/\/local\/task\/([^)]+)/)?.[1];
    const secondTaskId = second.content.match(/intent:\/\/local\/task\/([^)]+)/)?.[1];

    expect(firstTaskId).toBeDefined();
    expect(secondTaskId).toBe(firstTaskId);
  });
});
