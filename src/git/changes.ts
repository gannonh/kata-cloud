import type {
  SpaceGitChangeFile,
  SpaceGitFileStatusCode,
  SpaceGitStagedSummary
} from "./types";

const MERGE_CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export function parseGitStatusPorcelain(statusOutput: string): SpaceGitChangeFile[] {
  return statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map(parseStatusLine)
    .filter((entry): entry is SpaceGitChangeFile => entry !== null);
}

export function isStagedFileChange(change: SpaceGitChangeFile): boolean {
  return change.stagedStatus !== null;
}

export function isUnstagedFileChange(change: SpaceGitChangeFile): boolean {
  return change.unstagedStatus !== null;
}

export function toGitStatusLabel(status: SpaceGitFileStatusCode | null): string {
  switch (status) {
    case "M":
      return "Modified";
    case "A":
      return "Added";
    case "D":
      return "Deleted";
    case "R":
      return "Renamed";
    case "C":
      return "Copied";
    case "U":
      return "Conflict";
    case "?":
      return "Untracked";
    default:
      return "Clean";
  }
}

export function summarizeStagedChanges(
  files: SpaceGitChangeFile[],
  stagedNumstatOutput: string
): SpaceGitStagedSummary {
  const summary = createEmptyStagedSummary();

  for (const file of files) {
    if (!isStagedFileChange(file)) {
      continue;
    }

    summary.fileCount += 1;
    if (file.isConflicted) {
      summary.conflicted += 1;
    }

    switch (file.stagedStatus) {
      case "A":
        summary.added += 1;
        break;
      case "M":
        summary.modified += 1;
        break;
      case "D":
        summary.deleted += 1;
        break;
      case "R":
        summary.renamed += 1;
        break;
      case "C":
        summary.copied += 1;
        break;
      default:
        break;
    }
  }

  for (const line of stagedNumstatOutput.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const [insertionsRaw, deletionsRaw] = trimmed.split("\t");
    const insertions = Number.parseInt(insertionsRaw ?? "", 10);
    const deletions = Number.parseInt(deletionsRaw ?? "", 10);

    if (!Number.isNaN(insertions)) {
      summary.insertions += insertions;
    }
    if (!Number.isNaN(deletions)) {
      summary.deletions += deletions;
    }
  }

  return summary;
}

function createEmptyStagedSummary(): SpaceGitStagedSummary {
  return {
    fileCount: 0,
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    copied: 0,
    conflicted: 0,
    insertions: 0,
    deletions: 0
  };
}

function parseStatusLine(line: string): SpaceGitChangeFile | null {
  if (line.length < 3) {
    return null;
  }

  const stagedCode = line[0] ?? " ";
  const unstagedCode = line[1] ?? " ";
  const statusCode = `${stagedCode}${unstagedCode}`;
  const rawPath = line.slice(3);

  if (rawPath.length === 0 || statusCode === "!!") {
    return null;
  }

  const pathParts = splitPathField(rawPath);
  let stagedStatus = toStatusCode(stagedCode);
  let unstagedStatus = toStatusCode(unstagedCode);

  if (statusCode === "??") {
    stagedStatus = null;
    unstagedStatus = "?";
  }

  return {
    path: pathParts.path,
    previousPath: pathParts.previousPath,
    statusCode,
    stagedStatus,
    unstagedStatus,
    isConflicted:
      MERGE_CONFLICT_CODES.has(statusCode) || stagedCode === "U" || unstagedCode === "U"
  };
}

function splitPathField(rawPath: string): { path: string; previousPath: string | null } {
  const arrowIndex = rawPath.indexOf(" -> ");
  if (arrowIndex === -1) {
    return {
      path: decodeQuotedPath(rawPath),
      previousPath: null
    };
  }

  const previousPath = decodeQuotedPath(rawPath.slice(0, arrowIndex));
  const path = decodeQuotedPath(rawPath.slice(arrowIndex + 4));
  return {
    path,
    previousPath
  };
}

function decodeQuotedPath(rawPath: string): string {
  if (!rawPath.startsWith("\"") || !rawPath.endsWith("\"")) {
    return rawPath;
  }

  return rawPath
    .slice(1, -1)
    .replace(/\\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function toStatusCode(rawCode: string): SpaceGitFileStatusCode | null {
  switch (rawCode) {
    case "M":
    case "A":
    case "D":
    case "R":
    case "C":
    case "U":
    case "?":
      return rawCode;
    default:
      return null;
  }
}
