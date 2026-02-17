import { randomUUID } from "node:crypto";

import { normalizeTaskTitle, parseTaskBlocks, parseTaskLinks } from "./task-block-parser.js";

const TASK_LINK_PATTERN =
  /^- \[( |x|\/)\] \[([^\]]+)\]\(intent:\/\/local\/task\/([^)]+)\)$/gm;

export function syncTaskBlocks(specMarkdown, taskStore) {
  if (!taskStore || typeof taskStore.upsert !== "function") {
    throw new Error("syncTaskBlocks requires a task store with an upsert function.");
  }

  const existingLinks = parseTaskLinks(specMarkdown);
  const linkTaskQueueByTitle = buildLinkedTaskQueues(existingLinks);
  const fallbackTaskQueueByTitle = new Map();
  const consumedTaskIds = new Set();

  const parsedBlocks = parseTaskBlocks(specMarkdown);
  const replacements = [];
  const touchedTaskIds = [];

  for (const block of parsedBlocks) {
    const normalizedTitle = normalizeTaskTitle(block.title);
    const existingTask =
      takeLinkedTask(normalizedTitle, linkTaskQueueByTitle, taskStore, consumedTaskIds) ||
      takeFallbackTask(normalizedTitle, fallbackTaskQueueByTitle, taskStore, consumedTaskIds);

    const task = taskStore.upsert({
      id: existingTask?.id ?? randomUUID(),
      title: block.title,
      description: block.description,
      content: block.content,
      status: existingTask?.status ?? "not_started",
      sourceType: "spec_task_block"
    });

    consumedTaskIds.add(task.id);
    touchedTaskIds.push(task.id);
    replacements.push({
      start: block.start,
      end: block.end,
      value: `${renderTaskLinkLine(task)}${detectTrailingNewline(block.raw)}`
    });
  }

  let nextSpec = applyReplacements(specMarkdown, replacements);
  nextSpec = syncExistingTaskLinkStatuses(nextSpec, taskStore);
  nextSpec = dedupeTaskLinks(nextSpec);

  return {
    specMarkdown: nextSpec,
    taskIds: touchedTaskIds
  };
}

function buildLinkedTaskQueues(existingLinks) {
  const queueByTitle = new Map();
  for (const link of existingLinks) {
    const normalizedTitle = normalizeTaskTitle(link.title);
    const queue = queueByTitle.get(normalizedTitle) ?? [];
    queue.push(link.taskId);
    queueByTitle.set(normalizedTitle, queue);
  }

  return queueByTitle;
}

function takeLinkedTask(normalizedTitle, queueByTitle, taskStore, consumedTaskIds) {
  const queue = queueByTitle.get(normalizedTitle);
  if (!queue) {
    return null;
  }

  while (queue.length > 0) {
    const taskId = queue.shift();
    const task = taskStore.findById(taskId);
    if (!task || consumedTaskIds.has(task.id)) {
      continue;
    }

    return task;
  }

  return null;
}

function takeFallbackTask(normalizedTitle, queueByTitle, taskStore, consumedTaskIds) {
  if (!queueByTitle.has(normalizedTitle)) {
    let queue;
    if (typeof taskStore.findAllByTitle === "function") {
      queue = taskStore.findAllByTitle(normalizedTitle);
    } else {
      const singleTask = taskStore.findByTitle(normalizedTitle);
      queue = singleTask ? [singleTask] : [];
    }

    queueByTitle.set(normalizedTitle, queue);
  }

  const queue = queueByTitle.get(normalizedTitle) ?? [];
  while (queue.length > 0) {
    const task = queue.shift();
    if (!task || consumedTaskIds.has(task.id)) {
      continue;
    }

    return task;
  }

  return null;
}

export function createInMemoryTaskStore(seed = []) {
  const tasksById = new Map(seed.map((task) => [task.id, { ...task }]));

  function findById(id) {
    return id ? tasksById.get(id) || null : null;
  }

  function findByTitle(title) {
    return findAllByTitle(title)[0] ?? null;
  }

  function findAllByTitle(title) {
    const normalized = normalizeTaskTitle(title);
    return Array.from(tasksById.values())
      .filter((task) => normalizeTaskTitle(task.title) === normalized)
      .sort((left, right) => {
        const byCreatedAt = (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
        if (byCreatedAt !== 0) {
          return byCreatedAt;
        }

        return left.id.localeCompare(right.id);
      });
  }

  function upsert(input) {
    if (!input?.title) {
      throw new Error("upsert requires a task title.");
    }

    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    const previous = tasksById.get(id) || null;

    const next = {
      id,
      title: input.title,
      description: input.description ?? previous?.description ?? "",
      content: input.content ?? previous?.content ?? "",
      status: input.status ?? previous?.status ?? "not_started",
      sourceType: input.sourceType ?? previous?.sourceType ?? "spec_task_block",
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    };

    tasksById.set(id, next);
    return next;
  }

  function updateStatus(id, status) {
    const existing = tasksById.get(id);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      status,
      updatedAt: new Date().toISOString()
    };

    tasksById.set(id, updated);
    return updated;
  }

  return {
    findById,
    findAllByTitle,
    findByTitle,
    upsert,
    updateStatus,
    list: () => Array.from(tasksById.values())
  };
}

export function checkboxForStatus(status) {
  switch (status) {
    case "complete":
      return "x";
    case "in_progress":
    case "waiting":
    case "discussion_needed":
    case "review_required":
      return "/";
    default:
      return " ";
  }
}

function renderTaskLinkLine(task) {
  return `- [${checkboxForStatus(task.status)}] [${task.title}](intent://local/task/${task.id})`;
}

function applyReplacements(source, replacements) {
  if (replacements.length === 0) {
    return source;
  }

  const sorted = replacements.slice().sort((a, b) => b.start - a.start);
  let next = source;

  for (const replacement of sorted) {
    next = `${next.slice(0, replacement.start)}${replacement.value}${next.slice(replacement.end)}`;
  }

  return next;
}

function syncExistingTaskLinkStatuses(specMarkdown, taskStore) {
  return specMarkdown.replace(TASK_LINK_PATTERN, (full, _checkbox, _title, taskId) => {
    const task = taskStore.findById(taskId);
    if (!task) {
      return full;
    }

    return renderTaskLinkLine(task);
  });
}

function dedupeTaskLinks(specMarkdown) {
  const lines = specMarkdown.split(/\r?\n/);
  const deduped = [];
  const seenTaskIds = new Set();

  for (const line of lines) {
    const match = line.match(/^-\s\[(?: |x|\/)\]\s\[[^\]]+\]\(intent:\/\/local\/task\/([^)]+)\)$/);
    if (!match) {
      deduped.push(line);
      continue;
    }

    const taskId = match[1];
    if (seenTaskIds.has(taskId)) {
      continue;
    }

    seenTaskIds.add(taskId);
    deduped.push(line);
  }

  return deduped.join("\n");
}

function detectTrailingNewline(value) {
  if (value.endsWith("\r\n")) {
    return "\r\n";
  }

  if (value.endsWith("\n")) {
    return "\n";
  }

  return "";
}
