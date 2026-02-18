import { describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "../shared/shell-api";

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
}));

describe("preload IPC channels", () => {
  it("stays aligned with shared IPC channel definitions", async () => {
    const module = await import("./index");
    expect(module.PRELOAD_IPC_CHANNELS).toEqual(IPC_CHANNELS);
  });
});
