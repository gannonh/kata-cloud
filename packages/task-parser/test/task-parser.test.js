import { describe, expect, it } from "vitest";

import { createInMemoryTaskStore, syncTaskBlocks } from "../src/index.js";

describe("task-parser", () => {
  it("converts each @@@task block into exactly one task-note record", () => {
    const store = createInMemoryTaskStore();
    const spec = [
      "## Tasks",
      "@@@task",
      "# Build parser",
      "Turn blocks into task-note records.",
      "@@@",
      "",
      "@@@task",
      "# Wire sync",
      "Keep task links and statuses synchronized.",
      "@@@"
    ].join("\n");

    const { specMarkdown } = syncTaskBlocks(spec, store);

    expect(store.list()).toHaveLength(2);
    expect(specMarkdown.match(/intent:\/\/local\/task\//g) || []).toHaveLength(2);
    expect(specMarkdown.includes("@@@task")).toBe(false);
  });

  it("keeps task links stable and updates checkbox values as status changes", () => {
    const store = createInMemoryTaskStore();
    const spec = [
      "## Tasks",
      "@@@task",
      "# Build parser",
      "Turn blocks into task-note records.",
      "@@@"
    ].join("\n");

    const firstSync = syncTaskBlocks(spec, store);
    const taskId = firstSync.taskIds[0];

    store.updateStatus(taskId, "complete");
    const completedSync = syncTaskBlocks(firstSync.specMarkdown, store);
    expect(completedSync.specMarkdown).toContain(
      `- [x] [Build parser](intent://local/task/${taskId})`
    );

    store.updateStatus(taskId, "in_progress");
    const inProgressSync = syncTaskBlocks(completedSync.specMarkdown, store);
    expect(inProgressSync.specMarkdown).toContain(
      `- [/] [Build parser](intent://local/task/${taskId})`
    );
  });

  it("keeps one-block-one-task for duplicate titles in title-collapsing stores", () => {
    const tasksById = new Map();
    const taskIdByNormalizedTitle = new Map();
    let sequence = 0;

    const normalize = (value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const store = {
      findById(taskId) {
        return taskId ? tasksById.get(taskId) ?? null : null;
      },
      findByTitle(title) {
        const taskId = taskIdByNormalizedTitle.get(normalize(title));
        return taskId ? tasksById.get(taskId) ?? null : null;
      },
      upsert(input) {
        const normalizedTitle = normalize(input.title);
        const taskId =
          input.id ?? taskIdByNormalizedTitle.get(normalizedTitle) ?? `task-${sequence += 1}`;
        const next = {
          id: taskId,
          title: input.title,
          description: input.description ?? "",
          content: input.content ?? "",
          status: input.status ?? "not_started",
          sourceType: input.sourceType ?? "spec_task_block"
        };

        tasksById.set(taskId, next);
        taskIdByNormalizedTitle.set(normalizedTitle, taskId);
        return next;
      },
      list() {
        return Array.from(tasksById.values());
      }
    };

    const spec = [
      "## Tasks",
      "@@@task",
      "# Duplicate title",
      "First body.",
      "@@@",
      "",
      "@@@task",
      "# Duplicate title",
      "Second body.",
      "@@@"
    ].join("\n");

    const syncResult = syncTaskBlocks(spec, store);

    expect(syncResult.taskIds).toHaveLength(2);
    expect(new Set(syncResult.taskIds).size).toBe(2);
    expect(store.list()).toHaveLength(2);
    expect(syncResult.specMarkdown.match(/intent:\/\/local\/task\//g) || []).toHaveLength(2);
  });

  it("is idempotent and avoids duplicate task-note creation on re-read/update", () => {
    const store = createInMemoryTaskStore();
    const baseSpec = [
      "## Tasks",
      "@@@task",
      "# Build parser",
      "First description.",
      "@@@"
    ].join("\n");

    const firstSync = syncTaskBlocks(baseSpec, store);
    const firstTaskId = firstSync.taskIds[0];
    expect(store.list()).toHaveLength(1);

    const secondSync = syncTaskBlocks(firstSync.specMarkdown, store);
    expect(store.list()).toHaveLength(1);
    expect(secondSync.specMarkdown).toBe(firstSync.specMarkdown);

    const updatedSpec = [
      "## Tasks",
      "@@@task",
      "# Build parser",
      "Updated description.",
      "@@@"
    ].join("\n");
    const updatedSync = syncTaskBlocks(updatedSpec, store);

    expect(store.list()).toHaveLength(1);
    expect(updatedSync.taskIds[0]).toBe(firstTaskId);
    expect(store.list()[0].description).toContain("Updated description.");
  });
});
