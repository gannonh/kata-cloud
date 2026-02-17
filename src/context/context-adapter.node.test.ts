import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "vitest";
import { createContextAdapter, resolveContextProviderId } from "./context-adapter";
import { FilesystemContextProvider } from "./providers/filesystem-context-provider";
import { McpCompatibleStubContextProvider } from "./providers/mcp-context-provider";

test("filesystem provider returns snippets for matching prompt terms", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kata-context-"));
  try {
    const sourceDir = path.join(tempRoot, "src");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      path.join(sourceDir, "main.ts"),
      "export const engine = 'context adapter';\nexport const note = 'retrieve snippets';\n",
      "utf8"
    );

    const adapter = createContextAdapter({
      providers: [new FilesystemContextProvider(), new McpCompatibleStubContextProvider()],
      defaultProvider: "filesystem"
    });

    const snippets = await adapter.retrieve(
      {
        prompt: "retrieve context adapter snippets",
        spaceId: "space-1",
        sessionId: "session-1",
        rootPath: tempRoot,
        limit: 2
      },
      "filesystem"
    );

    assert.equal(snippets.length > 0, true);
    assert.equal(snippets[0]?.provider, "filesystem");
    assert.equal(snippets[0]?.path.endsWith("main.ts"), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("adapter falls back to default provider when requested provider is unavailable", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kata-context-fallback-"));
  try {
    const sourceDir = path.join(tempRoot, "src");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      path.join(sourceDir, "fallback.ts"),
      "export const fallback = 'filesystem provider fallback';\n",
      "utf8"
    );

    const adapter = createContextAdapter({
      providers: [new FilesystemContextProvider()],
      defaultProvider: "filesystem"
    });

    const snippets = await adapter.retrieve(
      {
        prompt: "provider fallback",
        spaceId: "space-1",
        sessionId: "session-1",
        rootPath: tempRoot,
        limit: 1
      },
      "mcp"
    );

    assert.equal(snippets.length > 0, true);
    assert.equal(snippets[0]?.provider, "filesystem");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("filesystem provider expands tilde-prefixed root paths", async () => {
  const homeRoot = os.homedir();
  const tempRoot = await mkdtemp(path.join(homeRoot, "kata-context-home-"));
  const tildeRoot = `~${tempRoot.slice(homeRoot.length)}`;
  try {
    const sourceDir = path.join(tempRoot, "src");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      path.join(sourceDir, "tilde.ts"),
      "export const setting = 'tilde path support';\n",
      "utf8"
    );

    const adapter = createContextAdapter({
      providers: [new FilesystemContextProvider()],
      defaultProvider: "filesystem"
    });

    const snippets = await adapter.retrieve(
      {
        prompt: "tilde path support",
        spaceId: "space-1",
        sessionId: "session-1",
        rootPath: tildeRoot,
        limit: 1
      },
      "filesystem"
    );

    assert.equal(snippets.length > 0, true);
    assert.equal(snippets[0]?.provider, "filesystem");
    assert.equal(snippets[0]?.path.endsWith("tilde.ts"), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("mcp stub provider returns no snippets", async () => {
  const adapter = createContextAdapter({
    providers: [new McpCompatibleStubContextProvider()],
    defaultProvider: "mcp"
  });

  const snippets = await adapter.retrieve(
    {
      prompt: "anything",
      spaceId: "space-1",
      sessionId: "session-1",
      rootPath: "/tmp"
    },
    "mcp"
  );

  assert.deepEqual(snippets, []);
});

test("session provider overrides space provider", () => {
  assert.equal(resolveContextProviderId("filesystem", "mcp"), "mcp");
  assert.equal(resolveContextProviderId("mcp", undefined), "mcp");
  assert.equal(resolveContextProviderId(undefined, undefined), "filesystem");
});
