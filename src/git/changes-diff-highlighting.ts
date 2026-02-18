export const DEFAULT_MAX_HIGHLIGHT_LINES = 2500;

export type DiffLineKind = "add" | "remove" | "hunk" | "meta" | "context";

export type HighlightedDiffLine = {
  text: string;
  kind: DiffLineKind;
};

export type HighlightedDiff =
  | {
      mode: "plain";
      text: string;
    }
  | {
      mode: "highlighted";
      lines: HighlightedDiffLine[];
    };

export function classifyDiffLine(line: string): DiffLineKind {
  if (line.startsWith("diff --git ")) {
    return "meta";
  }

  if (
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ") ||
    line.startsWith("rename from ") ||
    line.startsWith("rename to ") ||
    line.startsWith("new file mode ") ||
    line.startsWith("deleted file mode ") ||
    line.startsWith("Binary files ")
  ) {
    return "meta";
  }

  if (line.startsWith("@@")) {
    return "hunk";
  }

  if (line.startsWith("\\ No newline at end of file")) {
    return "meta";
  }

  if (line.startsWith("+")) {
    return "add";
  }

  if (line.startsWith("-")) {
    return "remove";
  }

  return "context";
}

export function highlightDiff(
  diffText: string,
  maxHighlightLines = DEFAULT_MAX_HIGHLIGHT_LINES
): HighlightedDiff {
  if (diffText.length === 0 || maxHighlightLines < 1) {
    return {
      mode: "plain",
      text: diffText
    };
  }

  if (hasMoreLinesThan(diffText, maxHighlightLines)) {
    return {
      mode: "plain",
      text: diffText
    };
  }

  return {
    mode: "highlighted",
    lines: diffText.split("\n").map((rawLine) => {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      return {
        text: line,
        kind: classifyDiffLine(line)
      };
    })
  };
}

function hasMoreLinesThan(value: string, maxLines: number): boolean {
  let lineCount = 1;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") {
      lineCount += 1;
      if (lineCount > maxLines) {
        return true;
      }
    }
  }

  return false;
}
