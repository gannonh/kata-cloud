import { describe, expect, it } from "vitest";
import { SpaceStore } from "./store";

describe("SpaceStore", () => {
  it("creates a space and rehydrates it from storage", () => {
    const storage = createMemoryStorage();
    const store = new SpaceStore(storage);
    const createResult = store.createSpace({
      prompt: "Build orchestrator",
      name: "orchestrator-space",
      path: "/tmp/orchestrator",
      repo: "https://github.com/example/repo",
      description: "Workspace for orchestrator features",
      tags: ["orchestrator", "mvp"]
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) {
      return;
    }

    expect(createResult.space.name).toBe("orchestrator-space");

    const nextStore = new SpaceStore(storage);
    const spaces = nextStore.loadSpaces();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]?.name).toBe("orchestrator-space");
    expect(spaces[0]?.tags).toEqual(["orchestrator", "mvp"]);
  });

  it("prevents duplicate names in the same workspace root", () => {
    const storage = createMemoryStorage();
    const store = new SpaceStore(storage);

    const first = store.createSpace({
      prompt: "A",
      name: "shared-name",
      path: "/tmp/workspace"
    });
    expect(first.ok).toBe(true);

    const duplicate = store.createSpace({
      prompt: "B",
      name: "SHARED-NAME",
      path: "/tmp/workspace/"
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) {
      return;
    }

    expect(duplicate.errors.name).toContain("already exists");
  });
});

function createMemoryStorage(): Storage {
  const memory = new Map<string, string>();
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
