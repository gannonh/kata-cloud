import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ContextProvider,
  ContextQuery,
  ContextRetrievalErrorCode,
  ContextRetrievalResult,
  ContextSnippet
} from "../types.js";

const DEFAULT_LIMIT = 5;
const MAX_FILE_BYTES = 200_000;
const MAX_FILES_TO_SCAN = 250;
const SKIPPED_DIRECTORIES = new Set([".git", "node_modules", "dist", "coverage"]);

function toSearchTerms(prompt: string): string[] {
  const terms = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((term) => term.length >= 3);
  return Array.from(new Set(terms));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFirstMatchIndex(raw: string, terms: string[]): number {
  for (const candidate of terms) {
    const matchIndex = raw.search(new RegExp(escapeRegExp(candidate), "i"));
    if (matchIndex !== -1) {
      return matchIndex;
    }
  }
  return -1;
}

function isProbablyBinary(content: string): boolean {
  return content.includes("\u0000");
}

function createSnippetContent(content: string, matchIndex: number): string {
  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(content.length, matchIndex + 220);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

function expandTilde(inputPath: string): string {
  const trimmedPath = inputPath.trim();
  if (trimmedPath === "~") {
    return os.homedir();
  }
  if (trimmedPath.startsWith("~/")) {
    return path.join(os.homedir(), trimmedPath.slice(2));
  }
  return trimmedPath;
}

async function collectFiles(rootPath: string): Promise<string[]> {
  const queue = [rootPath];
  const collected: string[] = [];

  while (queue.length > 0 && collected.length < MAX_FILES_TO_SCAN) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (collected.length >= MAX_FILES_TO_SCAN) {
        break;
      }

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          queue.push(fullPath);
        }
        continue;
      }

      // Symlinks are intentionally ignored to avoid path escape and loop risks.
      if (entry.isFile()) {
        collected.push(fullPath);
      }
    }
  }

  return collected;
}

export class FilesystemContextProvider implements ContextProvider {
  readonly id = "filesystem" as const;

  private createFailure(
    code: ContextRetrievalErrorCode,
    message: string,
    remediation: string,
    retryable: boolean
  ): ContextRetrievalResult {
    return {
      ok: false,
      providerId: this.id,
      snippets: [],
      error: {
        code,
        message,
        remediation,
        retryable,
        providerId: this.id
      }
    };
  }

  private createSuccess(snippets: ContextSnippet[]): ContextRetrievalResult {
    return {
      ok: true,
      providerId: this.id,
      snippets
    };
  }

  async retrieve(query: ContextQuery): Promise<ContextRetrievalResult> {
    const terms = toSearchTerms(query.prompt);
    if (terms.length === 0) {
      return this.createFailure(
        "invalid_query",
        "Context query did not include searchable terms.",
        "Provide a prompt with at least one meaningful search term.",
        false
      );
    }

    const requestRootPath = expandTilde(query.rootPath);
    if (requestRootPath.length === 0) {
      return this.createFailure(
        "invalid_root_path",
        "Context retrieval root path is empty.",
        "Select a space with a valid workspace root path before running orchestration.",
        false
      );
    }

    try {
      const rootMetadata = await stat(requestRootPath);
      if (!rootMetadata.isDirectory()) {
        return this.createFailure(
          "invalid_root_path",
          `Context retrieval root path is not a directory: ${requestRootPath}`,
          "Update the space root path to a readable project directory.",
          false
        );
      }
    } catch {
      return this.createFailure(
        "invalid_root_path",
        `Context retrieval root path is unavailable: ${requestRootPath}`,
        "Update the space root path to an existing directory.",
        false
      );
    }

    if (
      query.limit !== undefined &&
      (!Number.isFinite(query.limit) || !Number.isInteger(query.limit) || query.limit < 1)
    ) {
      return this.createFailure(
        "invalid_query",
        "Context retrieval limit must be a positive integer.",
        "Use a positive integer limit value when requesting context snippets.",
        false
      );
    }

    const files = await collectFiles(requestRootPath);
    const snippets: ContextSnippet[] = [];
    const maxResults = query.limit ?? DEFAULT_LIMIT;

    for (const filePath of files) {
      if (snippets.length >= maxResults) {
        break;
      }

      try {
        const metadata = await stat(filePath);
        if (metadata.size > MAX_FILE_BYTES) {
          continue;
        }

        const raw = await readFile(filePath, "utf8");
        if (isProbablyBinary(raw)) {
          continue;
        }

        const matchIndex = findFirstMatchIndex(raw, terms);
        if (matchIndex === -1) {
          continue;
        }

        snippets.push({
          id: `${this.id}:${filePath}`,
          provider: this.id,
          path: filePath,
          source: "filesystem",
          content: createSnippetContent(raw, matchIndex),
          score: 1
        });
      } catch {
        // Keep retrieval resilient when individual files cannot be read.
      }
    }

    return this.createSuccess(snippets);
  }
}
