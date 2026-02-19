import type {
  SpaceGitChangeFile,
  SpaceGitFileStatusCode,
  SpaceGitStagedSummary
} from "./types.js";

const MERGE_CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
const UTF8_DECODER = new TextDecoder();

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
  const stagedPaths = new Set(
    files
      .filter((file) => isStagedFileChange(file))
      .map((file) => file.path)
  );

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

    const [insertionsRaw, deletionsRaw, ...pathParts] = trimmed.split("\t");
    const numstatPath = normalizeNumstatPath(pathParts.join("\t"));
    if (!stagedPaths.has(numstatPath)) {
      continue;
    }

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

function normalizeNumstatPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  const braceRenameMatch = trimmed.match(/^(.*)\{(.+) => (.+)\}(.*)$/);
  if (braceRenameMatch) {
    const [, prefix, , renamedTarget, suffix] = braceRenameMatch;
    return `${prefix}${renamedTarget}${suffix}`;
  }

  const renameArrowIndex = trimmed.indexOf(" => ");
  if (renameArrowIndex !== -1) {
    return trimmed.slice(renameArrowIndex + 4);
  }

  return decodeQuotedPath(trimmed);
}

function decodeQuotedPath(rawPath: string): string {
  if (!rawPath.startsWith("\"") || !rawPath.endsWith("\"")) {
    return rawPath;
  }

  const unwrapped = rawPath.slice(1, -1);
  const decodedCharacters: string[] = [];
  const octalByteBuffer: number[] = [];

  function flushOctalBytes(): void {
    if (octalByteBuffer.length === 0) {
      return;
    }

    decodedCharacters.push(UTF8_DECODER.decode(new Uint8Array(octalByteBuffer)));
    octalByteBuffer.length = 0;
  }

  for (let index = 0; index < unwrapped.length; index += 1) {
    const current = unwrapped[index] ?? "";
    if (current !== "\\") {
      flushOctalBytes();
      decodedCharacters.push(current);
      continue;
    }

    const next = unwrapped[index + 1] ?? "";
    const nextTwo = unwrapped[index + 2] ?? "";
    const nextThree = unwrapped[index + 3] ?? "";

    if (isOctalDigit(next) && isOctalDigit(nextTwo) && isOctalDigit(nextThree)) {
      octalByteBuffer.push(Number.parseInt(`${next}${nextTwo}${nextThree}`, 8));
      index += 3;
      continue;
    }

    flushOctalBytes();
    if (next === "\"" || next === "\\") {
      decodedCharacters.push(next);
      index += 1;
      continue;
    }

    decodedCharacters.push(next);
    index += 1;
  }

  flushOctalBytes();
  return decodedCharacters.join("");
}

function isOctalDigit(value: string): boolean {
  return value.length === 1 && value >= "0" && value <= "7";
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
