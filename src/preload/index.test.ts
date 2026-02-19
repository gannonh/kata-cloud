import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IPC_CHANNELS } from "../shared/shell-api.js";

describe("preload IPC channels", () => {
  it("stays aligned with shared IPC channel definitions", () => {
    const sourcePath = path.resolve(process.cwd(), "src/preload/index.cts");
    const source = readFileSync(sourcePath, "utf8");
    const match = source.match(
      /export const PRELOAD_IPC_CHANNELS = (\{[\s\S]*?\}) as const;/
    );
    expect(match).not.toBeNull();
    const literal = match?.[1];
    expect(literal).toBeDefined();
    const preloadChannels = literal
      ? new Function(`return (${literal});`)()
      : null;
    expect(preloadChannels).toEqual(IPC_CHANNELS);
  });
});
