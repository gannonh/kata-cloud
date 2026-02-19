import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { test } from "vitest";
import { createContextAdapter, resolveContextProviderId } from "./context-adapter";
import { FilesystemContextProvider } from "./providers/filesystem-context-provider";
import { McpCompatibleStubContextProvider } from "./providers/mcp-context-provider";

test("filesystem provider returns typed success snippets for matching prompt terms", async () => {
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

    const result = await adapter.retrieve({
      prompt: "retrieve context adapter snippets",
      spaceId: "space-1",
      sessionId: "session-1",
      rootPath: tempRoot,
      providerId: "filesystem",
      limit: 2
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.providerId, "filesystem");
    assert.equal(result.snippets.length > 0, true);
    assert.equal(result.snippets[0]?.provider, "filesystem");
    assert.equal(result.snippets[0]?.path.endsWith("main.ts"), true);
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

    const result = await adapter.retrieve({
      prompt: "provider fallback",
      spaceId: "space-1",
      sessionId: "session-1",
      rootPath: tempRoot,
      providerId: "mcp",
      limit: 1
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.providerId, "filesystem");
    assert.equal(result.fallbackFromProviderId, "mcp");
    assert.equal(result.snippets.length > 0, true);
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

    const result = await adapter.retrieve({
      prompt: "tilde path support",
      spaceId: "space-1",
      sessionId: "session-1",
      rootPath: tildeRoot,
      providerId: "filesystem",
      limit: 1
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.snippets.length > 0, true);
    assert.equal(result.snippets[0]?.provider, "filesystem");
    assert.equal(result.snippets[0]?.path.endsWith("tilde.ts"), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("mcp stub provider returns a typed unavailable-provider failure", async () => {
  const adapter = createContextAdapter({
    providers: [new McpCompatibleStubContextProvider()],
    defaultProvider: "mcp"
  });

  const result = await adapter.retrieve({
    prompt: "anything",
    spaceId: "space-1",
    sessionId: "session-1",
    rootPath: "/tmp",
    providerId: "mcp"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }
  assert.equal(result.error.code, "provider_unavailable");
  assert.equal(result.error.retryable, true);
  assert.equal(result.providerId, "mcp");
});

test("filesystem provider returns typed invalid_query failure for non-searchable prompts", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kata-context-invalid-query-"));
  try {
    const adapter = createContextAdapter({
      providers: [new FilesystemContextProvider()],
      defaultProvider: "filesystem"
    });

    const result = await adapter.retrieve({
      prompt: "..",
      spaceId: "space-1",
      sessionId: "session-1",
      rootPath: tempRoot,
      providerId: "filesystem",
      limit: 1
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, "invalid_query");
    assert.equal(result.error.retryable, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("legacy adapter signature remains backward-compatible for snippet-only callers", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "kata-context-legacy-"));
  try {
    const sourceDir = path.join(tempRoot, "src");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(
      path.join(sourceDir, "legacy.ts"),
      "export const legacy = 'adapter compatibility';\n",
      "utf8"
    );

    const adapter = createContextAdapter({
      providers: [new FilesystemContextProvider()],
      defaultProvider: "filesystem"
    });

    const snippets = await adapter.retrieve(
      {
        prompt: "adapter compatibility",
        spaceId: "space-1",
        sessionId: "session-1",
        rootPath: tempRoot,
        limit: 1
      },
      "filesystem"
    );

    assert.equal(snippets.length, 1);
    assert.equal(snippets[0]?.path.endsWith("legacy.ts"), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("session provider overrides space provider", () => {
  assert.equal(resolveContextProviderId("filesystem", "mcp"), "mcp");
  assert.equal(resolveContextProviderId("mcp", undefined), "mcp");
  assert.equal(resolveContextProviderId(undefined, undefined), "filesystem");
});
