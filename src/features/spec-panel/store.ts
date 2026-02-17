import type {
  SpecComment,
  SpecCommentThread,
  SpecCommentTreeNode,
  SpecNoteDocument,
  SpecTaskRecord,
  SpecTaskStatus
} from "./types";

export const SPEC_NOTE_STORAGE_KEY = "kata-cloud.spec-note.v1";
const TASK_BLOCK_PATTERN = /^[ \t]*@@@task[ \t]*\r?\n([\s\S]*?)^[ \t]*@@@[ \t]*(?:\r?\n|$)/gm;
const TASK_LINK_PATTERN = /^- \[( |x|\/)\] \[([^\]]+)\]\(intent:\/\/local\/task\/([^)]+)\)$/gm;

type ParsedTaskLink = {
  checkbox: " " | "x" | "/";
  title: string;
  taskId: string;
};

type ParsedTaskBlock = {
  raw: string;
  start: number;
  end: number;
  content: string;
  title: string;
  description: string;
};

type ThreadMutationInput = {
  anchor: string;
  body: string;
  author: string;
};

type ReplyMutationInput = {
  threadId: string;
  parentCommentId: string;
  body: string;
  author: string;
};

export type StoreDependencies = {
  now?: () => string;
  makeId?: () => string;
};

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultMakeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `note_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultTaskId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `task_${Math.random().toString(36).slice(2, 10)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComment(value: unknown): value is SpecComment {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (typeof value.parentId === "string" || value.parentId === null) &&
    typeof value.author === "string" &&
    typeof value.body === "string" &&
    typeof value.createdAt === "string"
  );
}

function isThread(value: unknown): value is SpecCommentThread {
  if (!isObject(value) || !Array.isArray(value.comments)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.anchor === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    value.comments.every((entry) => isComment(entry))
  );
}

function isTaskStatus(value: unknown): value is SpecTaskStatus {
  return (
    value === "not_started" ||
    value === "in_progress" ||
    value === "waiting" ||
    value === "discussion_needed" ||
    value === "review_required" ||
    value === "complete"
  );
}

function isTaskRecord(value: unknown): value is SpecTaskRecord {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.content === "string" &&
    isTaskStatus(value.status) &&
    value.sourceType === "spec_task_block" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function createDefaultSpecNote(now: () => string = defaultNow): SpecNoteDocument {
  const timestamp = now();
  return {
    content: "## Goal\nDescribe the project outcome.\n\n## Tasks\n- [ ] Add initial tasks",
    updatedAt: timestamp,
    threads: [],
    tasks: []
  };
}

export function loadSpecNote(storage: Storage, storageKey = SPEC_NOTE_STORAGE_KEY): SpecNoteDocument {
  const raw = storage.getItem(storageKey);
  if (!raw) {
    return createDefaultSpecNote();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || !Array.isArray(parsed.threads)) {
      return createDefaultSpecNote();
    }

    const normalized: SpecNoteDocument = {
      content: typeof parsed.content === "string" ? parsed.content : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : defaultNow(),
      threads: parsed.threads.filter((entry) => isThread(entry)),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((entry) => isTaskRecord(entry)) : []
    };

    return normalized;
  } catch {
    return createDefaultSpecNote();
  }
}

export function saveSpecNote(
  storage: Storage,
  nextDocument: SpecNoteDocument,
  storageKey = SPEC_NOTE_STORAGE_KEY
): SpecNoteDocument {
  const persisted = loadSpecNote(storage, storageKey);
  const seedTasks = buildSeedTaskRecords(nextDocument.tasks ?? [], persisted.tasks ?? []);
  const synced = syncTaskBlocks(nextDocument.content, seedTasks);

  const normalized: SpecNoteDocument = {
    ...nextDocument,
    content: synced.specMarkdown,
    tasks: synced.tasks
  };

  storage.setItem(storageKey, JSON.stringify(normalized));
  return normalized;
}

export function addCommentThread(
  document: SpecNoteDocument,
  input: ThreadMutationInput,
  deps: StoreDependencies = {}
): SpecNoteDocument {
  const anchor = input.anchor.trim();
  const body = input.body.trim();
  const author = input.author.trim();
  if (!anchor || !body || !author) {
    return document;
  }

  const now = deps.now ?? defaultNow;
  const makeId = deps.makeId ?? defaultMakeId;
  const timestamp = now();

  const nextThread: SpecCommentThread = {
    id: `thread_${makeId()}`,
    anchor,
    createdAt: timestamp,
    updatedAt: timestamp,
    comments: [
      {
        id: `comment_${makeId()}`,
        parentId: null,
        body,
        author,
        createdAt: timestamp
      }
    ]
  };

  return {
    ...document,
    updatedAt: timestamp,
    threads: [...document.threads, nextThread]
  };
}

export function addCommentReply(
  document: SpecNoteDocument,
  input: ReplyMutationInput,
  deps: StoreDependencies = {}
): SpecNoteDocument {
  const body = input.body.trim();
  const author = input.author.trim();
  if (!body || !author) {
    return document;
  }

  const now = deps.now ?? defaultNow;
  const makeId = deps.makeId ?? defaultMakeId;
  const timestamp = now();

  let updated = false;
  const threads = document.threads.map((thread) => {
    if (thread.id !== input.threadId) {
      return thread;
    }

    const hasParent = thread.comments.some((comment) => comment.id === input.parentCommentId);
    if (!hasParent) {
      return thread;
    }

    updated = true;
    return {
      ...thread,
      updatedAt: timestamp,
      comments: [
        ...thread.comments,
        {
          id: `comment_${makeId()}`,
          parentId: input.parentCommentId,
          body,
          author,
          createdAt: timestamp
        }
      ]
    };
  });

  if (!updated) {
    return document;
  }

  return {
    ...document,
    updatedAt: timestamp,
    threads
  };
}

export function buildCommentTree(thread: SpecCommentThread): SpecCommentTreeNode[] {
  const buckets = new Map<string | null, SpecComment[]>();
  const sorted = [...thread.comments].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  for (const comment of sorted) {
    const bucket = buckets.get(comment.parentId) ?? [];
    bucket.push(comment);
    buckets.set(comment.parentId, bucket);
  }

  const visit = (comment: SpecComment): SpecCommentTreeNode => {
    const children = buckets.get(comment.id) ?? [];
    return {
      ...comment,
      children: children.map(visit)
    };
  };

  return (buckets.get(null) ?? []).map(visit);
}

function buildSeedTaskRecords(...groups: SpecTaskRecord[][]): SpecTaskRecord[] {
  const records = new Map<string, SpecTaskRecord>();

  for (const group of groups) {
    for (const task of group) {
      if (!task?.id) {
        continue;
      }

      records.set(task.id, { ...task });
    }
  }

  return Array.from(records.values()).sort((left, right) => {
    const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }

    return left.id.localeCompare(right.id);
  });
}

function syncTaskBlocks(specMarkdown: string, seedTasks: SpecTaskRecord[]) {
  const tasksById = new Map(seedTasks.map((task) => [task.id, { ...task }]));
  const linkTaskQueueByTitle = buildLinkedTaskQueues(parseTaskLinks(specMarkdown));
  const fallbackTaskQueueByTitle = new Map<string, SpecTaskRecord[]>();
  const consumedTaskIds = new Set<string>();
  const replacements: { start: number; end: number; value: string }[] = [];

  for (const link of parseTaskLinks(specMarkdown)) {
    const existing = tasksById.get(link.taskId);
    if (!existing) {
      continue;
    }
    tasksById.set(link.taskId, {
      ...existing,
      status: statusForCheckbox(link.checkbox)
    });
  }

  for (const block of parseTaskBlocks(specMarkdown)) {
    const normalizedTitle = normalizeTaskTitle(block.title);
    const existingTask =
      takeLinkedTask(normalizedTitle, linkTaskQueueByTitle, tasksById, consumedTaskIds) ||
      takeFallbackTask(normalizedTitle, fallbackTaskQueueByTitle, tasksById, consumedTaskIds);

    const now = defaultNow();
    const taskId = existingTask?.id ?? defaultTaskId();
    const nextTask: SpecTaskRecord = {
      id: taskId,
      title: block.title,
      description: block.description,
      content: block.content,
      status: existingTask?.status ?? "not_started",
      sourceType: "spec_task_block",
      createdAt: existingTask?.createdAt ?? now,
      updatedAt: now
    };

    tasksById.set(taskId, nextTask);
    consumedTaskIds.add(taskId);
    replacements.push({
      start: block.start,
      end: block.end,
      value: `${renderTaskLinkLine(nextTask)}${detectTrailingNewline(block.raw)}`
    });
  }

  let nextSpec = applyReplacements(specMarkdown, replacements);
  nextSpec = syncExistingTaskLinkStatuses(nextSpec, tasksById);
  nextSpec = dedupeTaskLinks(nextSpec);

  const referencedTaskIds = new Set(parseTaskLinks(nextSpec).map((link) => link.taskId));
  const tasks = Array.from(tasksById.values())
    .filter((task) => referencedTaskIds.has(task.id))
    .sort((left, right) => {
      const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }

      return left.id.localeCompare(right.id);
    });

  return {
    specMarkdown: nextSpec,
    tasks
  };
}

function parseTaskBlocks(markdown: string): ParsedTaskBlock[] {
  if (!markdown) {
    return [];
  }

  TASK_BLOCK_PATTERN.lastIndex = 0;
  const blocks: ParsedTaskBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = TASK_BLOCK_PATTERN.exec(markdown)) !== null) {
    const raw = match[0];
    const content = stripTrailingWhitespace(match[1]);
    const { title, description } = parseTaskBlockContent(content);

    blocks.push({
      raw,
      start: match.index,
      end: match.index + raw.length,
      content,
      title,
      description
    });
  }

  return blocks;
}

function parseTaskLinks(markdown: string): ParsedTaskLink[] {
  if (!markdown) {
    return [];
  }

  TASK_LINK_PATTERN.lastIndex = 0;
  const links: ParsedTaskLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = TASK_LINK_PATTERN.exec(markdown)) !== null) {
    const checkbox = match[1];
    if (checkbox !== " " && checkbox !== "x" && checkbox !== "/") {
      continue;
    }

    links.push({
      checkbox,
      title: match[2],
      taskId: match[3]
    });
  }

  return links;
}

function parseTaskBlockContent(content: string) {
  const lines = content.split(/\r?\n/);
  let title = "";
  let titleLine = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^#\s+(.+?)\s*$/);
    if (heading) {
      title = heading[1].trim();
      titleLine = index;
      break;
    }
  }

  if (!title) {
    const firstNonEmpty = lines.find((line) => line.trim().length > 0) || "Untitled task";
    title = firstNonEmpty.replace(/^#+\s*/, "").trim();
  }

  const descriptionLines =
    titleLine >= 0 ? lines.slice(titleLine + 1) : lines.filter((line, index) => index > 0);

  return {
    title,
    description: stripTrailingWhitespace(descriptionLines.join("\n")).trim()
  };
}

function buildLinkedTaskQueues(existingLinks: ParsedTaskLink[]) {
  const queueByTitle = new Map<string, string[]>();
  for (const link of existingLinks) {
    const normalizedTitle = normalizeTaskTitle(link.title);
    const queue = queueByTitle.get(normalizedTitle) ?? [];
    queue.push(link.taskId);
    queueByTitle.set(normalizedTitle, queue);
  }

  return queueByTitle;
}

function takeLinkedTask(
  normalizedTitle: string,
  queueByTitle: Map<string, string[]>,
  tasksById: Map<string, SpecTaskRecord>,
  consumedTaskIds: Set<string>
): SpecTaskRecord | null {
  const queue = queueByTitle.get(normalizedTitle);
  if (!queue) {
    return null;
  }

  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId) {
      continue;
    }
    const task = tasksById.get(taskId);
    if (!task || consumedTaskIds.has(task.id)) {
      continue;
    }

    return task;
  }

  return null;
}

function takeFallbackTask(
  normalizedTitle: string,
  queueByTitle: Map<string, SpecTaskRecord[]>,
  tasksById: Map<string, SpecTaskRecord>,
  consumedTaskIds: Set<string>
): SpecTaskRecord | null {
  if (!queueByTitle.has(normalizedTitle)) {
    const queue = Array.from(tasksById.values())
      .filter((task) => normalizeTaskTitle(task.title) === normalizedTitle)
      .sort((left, right) => {
        const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
        if (byCreatedAt !== 0) {
          return byCreatedAt;
        }

        return left.id.localeCompare(right.id);
      });

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

function normalizeTaskTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function applyReplacements(source: string, replacements: { start: number; end: number; value: string }[]) {
  if (replacements.length === 0) {
    return source;
  }

  const sorted = replacements.slice().sort((left, right) => right.start - left.start);
  let next = source;

  for (const replacement of sorted) {
    next = `${next.slice(0, replacement.start)}${replacement.value}${next.slice(replacement.end)}`;
  }

  return next;
}

function syncExistingTaskLinkStatuses(specMarkdown: string, tasksById: Map<string, SpecTaskRecord>) {
  TASK_LINK_PATTERN.lastIndex = 0;
  return specMarkdown.replace(TASK_LINK_PATTERN, (full, _checkbox, _title, taskId) => {
    const task = tasksById.get(taskId);
    if (!task) {
      return full;
    }

    return renderTaskLinkLine(task);
  });
}

function dedupeTaskLinks(specMarkdown: string) {
  const lines = specMarkdown.split(/\r?\n/);
  const deduped: string[] = [];
  const seenTaskIds = new Set<string>();

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

function detectTrailingNewline(value: string) {
  if (value.endsWith("\r\n")) {
    return "\r\n";
  }

  return value.endsWith("\n") ? "\n" : "";
}

function renderTaskLinkLine(task: Pick<SpecTaskRecord, "id" | "title" | "status">) {
  return `- [${checkboxForStatus(task.status)}] [${task.title}](intent://local/task/${task.id})`;
}

function checkboxForStatus(status: SpecTaskStatus) {
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

function statusForCheckbox(checkbox: ParsedTaskLink["checkbox"]): SpecTaskStatus {
  switch (checkbox) {
    case "x":
      return "complete";
    case "/":
      return "in_progress";
    default:
      return "not_started";
  }
}

function stripTrailingWhitespace(value: string) {
  return value.replace(/\s+$/g, "");
}
