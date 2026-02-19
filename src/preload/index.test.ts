import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IPC_CHANNELS } from "../shared/shell-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("preload IPC channels", () => {
  it("stays aligned with shared IPC channel definitions", () => {
    const sourcePath = path.resolve(__dirname, "index.cts");
    const source = readFileSync(sourcePath, "utf8");
    const match = source.match(
      /export const PRELOAD_IPC_CHANNELS\s*=\s*(\{[\s\S]*?\})\s*as\s+const;?/
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
