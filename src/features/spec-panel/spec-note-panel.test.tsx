import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import { SpecNotePanel } from "./spec-note-panel";
import { SPEC_NOTE_STORAGE_KEY } from "./store";

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

describe("SpecNotePanel", () => {
  it("autosaves edited spec content", () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();

    render(<SpecNotePanel storage={storage} autosaveDelayMs={50} />);

    const editor = screen.getByLabelText("Spec Markdown");
    fireEvent.change(editor, { target: { value: "## Goal\nUpdated plan" } });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const raw = storage.getItem(SPEC_NOTE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toContain("Updated plan");
    vi.useRealTimers();
  });

  it("creates a thread and reply, then persists both", () => {
    const storage = createMemoryStorage();
    const ids = ["a", "b", "c", "d"];
    let idIndex = 0;
    render(
      <SpecNotePanel
        storage={storage}
        autosaveDelayMs={10}
        now={() => "2026-02-16T00:00:00.000Z"}
        makeId={() => ids[idIndex++] ?? "fallback"}
      />
    );

    fireEvent.change(screen.getByLabelText("Anchor"), { target: { value: "## Goal" } });
    fireEvent.change(screen.getByLabelText("Author"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Need a stricter DoD" } });
    fireEvent.click(screen.getByRole("button", { name: "Add thread" }));

    expect(screen.getByText("Need a stricter DoD")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reply author comment_b"), { target: { value: "bob" } });
    fireEvent.change(screen.getByLabelText("Reply body comment_b"), { target: { value: "Added verification steps" } });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    expect(screen.getByText("Added verification steps")).toBeInTheDocument();

    const raw = storage.getItem(SPEC_NOTE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).toContain("Need a stricter DoD");
    expect(raw).toContain("Added verification steps");
  });

  it("rehydrates persisted content and comments on mount", () => {
    const seededState = JSON.stringify({
      content: "## Seeded",
      updatedAt: "2026-02-16T00:00:00.000Z",
      threads: [
        {
          id: "thread_1",
          anchor: "## Seeded",
          createdAt: "2026-02-16T00:00:00.000Z",
          updatedAt: "2026-02-16T00:00:00.000Z",
          comments: [
            {
              id: "comment_1",
              parentId: null,
              author: "reviewer",
              body: "Restored",
              createdAt: "2026-02-16T00:00:00.000Z"
            }
          ]
        }
      ]
    });
    const storage = createMemoryStorage({ [SPEC_NOTE_STORAGE_KEY]: seededState });

    render(<SpecNotePanel storage={storage} autosaveDelayMs={10} />);

    expect(screen.getByLabelText("Spec Markdown")).toHaveValue("## Seeded");
    expect(screen.getByText("Restored")).toBeInTheDocument();
  });
});
