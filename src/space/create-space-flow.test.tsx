import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CreateSpaceFlow } from "./create-space-flow.js";
import { SpaceStore } from "./store.js";

describe("CreateSpaceFlow", () => {
  it("creates a space from a prompt-driven workflow", async () => {
    const user = userEvent.setup();
    const store = new SpaceStore(createMemoryStorage());

    render(<CreateSpaceFlow store={store} />);

    await user.type(
      screen.getByLabelText("Project Prompt"),
      "Implement space metadata persistence"
    );
    await user.click(screen.getByRole("button", { name: "Create space" }));

    expect(screen.getByLabelText("Space Name")).toHaveValue(
      "implement-space-metadata-persistence"
    );

    await user.type(screen.getByLabelText("Workspace Root Path"), "/tmp/spaces");
    await user.type(
      screen.getByLabelText("Repo Link (optional)"),
      "https://github.com/example/kata-cloud"
    );
    await user.type(screen.getByLabelText("Description (optional)"), "Primary workspace");
    await user.type(screen.getByLabelText(/Tags \(optional\)/i), "mvp, spaces");

    await user.click(screen.getByRole("button", { name: "Save space" }));

    expect(screen.getByText("implement-space-metadata-persistence")).toBeInTheDocument();
    expect(screen.getByText("/tmp/spaces - https://github.com/example/kata-cloud")).toBeInTheDocument();
    expect(screen.getByText("Primary workspace")).toBeInTheDocument();
    expect(screen.getByText("mvp")).toBeInTheDocument();
    expect(screen.getByText("spaces")).toBeInTheDocument();
  });

  it("rehydrates persisted spaces on relaunch", async () => {
    const user = userEvent.setup();
    const storage = createMemoryStorage();
    const firstStore = new SpaceStore(storage);

    const firstRender = render(<CreateSpaceFlow store={firstStore} />);

    await user.type(screen.getByLabelText("Project Prompt"), "Build context engine");
    await user.click(screen.getByRole("button", { name: "Create space" }));
    await user.type(screen.getByLabelText("Workspace Root Path"), "/tmp/context");
    await user.click(screen.getByRole("button", { name: "Save space" }));
    expect(screen.getByText("build-context-engine")).toBeInTheDocument();

    firstRender.unmount();

    const secondStore = new SpaceStore(storage);
    render(<CreateSpaceFlow store={secondStore} />);

    expect(screen.getByText("build-context-engine")).toBeInTheDocument();
    expect(screen.getByText("/tmp/context")).toBeInTheDocument();
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
