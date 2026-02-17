const TASK_BLOCK_PATTERN =
  /^[ \t]*@@@task[ \t]*\r?\n([\s\S]*?)^[ \t]*@@@[ \t]*(?:\r?\n|$)/gm;

const TASK_LINK_LINE_PATTERN =
  /^- \[( |x|\/)\] \[([^\]]+)\]\(intent:\/\/local\/task\/([^)]+)\)$/gm;

export function parseTaskBlocks(markdown) {
  if (!markdown) {
    return [];
  }

  const blocks = [];
  let match;

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

export function parseTaskLinks(markdown) {
  if (!markdown) {
    return [];
  }

  const links = [];
  let match;

  while ((match = TASK_LINK_LINE_PATTERN.exec(markdown)) !== null) {
    links.push({
      checkbox: match[1],
      title: match[2],
      taskId: match[3]
    });
  }

  return links;
}

function parseTaskBlockContent(content) {
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

export function normalizeTaskTitle(title) {
  return (title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function stripTrailingWhitespace(value) {
  return value.replace(/\s+$/g, "");
}
