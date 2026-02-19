import { describe, expect, it } from "vitest";
import { classifyDiffLine, highlightDiff } from "./changes-diff-highlighting.js";

describe("classifyDiffLine", () => {
  it("classifies metadata, hunks, additions, removals, and context lines", () => {
    expect(classifyDiffLine("diff --git a/src/app.ts b/src/app.ts")).toBe("meta");
    expect(classifyDiffLine("index 123..456 100644")).toBe("meta");
    expect(classifyDiffLine("--- a/src/app.ts")).toBe("meta");
    expect(classifyDiffLine("+++ b/src/app.ts")).toBe("meta");
    expect(classifyDiffLine("rename from src/old.ts")).toBe("meta");
    expect(classifyDiffLine("rename to src/new.ts")).toBe("meta");
    expect(classifyDiffLine("new file mode 100644")).toBe("meta");
    expect(classifyDiffLine("deleted file mode 100644")).toBe("meta");
    expect(classifyDiffLine("Binary files a/x.png and b/x.png differ")).toBe("meta");
    expect(classifyDiffLine("@@ -1,2 +1,3 @@")).toBe("hunk");
    expect(classifyDiffLine("+const next = true;")).toBe("add");
    expect(classifyDiffLine("-const next = false;")).toBe("remove");
    expect(classifyDiffLine(" unchanged line")).toBe("context");
  });

  it("treats no-newline markers as metadata", () => {
    expect(classifyDiffLine("\\ No newline at end of file")).toBe("meta");
  });
});

describe("highlightDiff", () => {
  it("returns plain mode for an empty diff", () => {
    expect(highlightDiff("")).toEqual({
      mode: "plain",
      text: ""
    });
  });

  it("returns highlighted line entries for small diffs", () => {
    const result = highlightDiff(
      [
        "diff --git a/src/app.ts b/src/app.ts",
        "@@ -1 +1 @@",
        "-const before = 1;",
        "+const after = 2;",
        " context"
      ].join("\n")
    );

    expect(result.mode).toBe("highlighted");
    if (result.mode !== "highlighted") {
      return;
    }

    expect(result.lines).toEqual([
      { text: "diff --git a/src/app.ts b/src/app.ts", kind: "meta" },
      { text: "@@ -1 +1 @@", kind: "hunk" },
      { text: "-const before = 1;", kind: "remove" },
      { text: "+const after = 2;", kind: "add" },
      { text: " context", kind: "context" }
    ]);
  });

  it("falls back to plain mode when diff exceeds the max line threshold", () => {
    const result = highlightDiff("line-1\nline-2\nline-3", 2);

    expect(result).toEqual({
      mode: "plain",
      text: "line-1\nline-2\nline-3"
    });
  });

  it("falls back to plain mode when maxHighlightLines is less than 1", () => {
    expect(highlightDiff("+line", 0)).toEqual({
      mode: "plain",
      text: "+line"
    });
  });

  it("normalizes CRLF line endings per rendered line", () => {
    const result = highlightDiff("+one\r\n-two\r\n three\r\n", 10);

    expect(result.mode).toBe("highlighted");
    if (result.mode !== "highlighted") {
      return;
    }

    expect(result.lines).toEqual([
      { text: "+one", kind: "add" },
      { text: "-two", kind: "remove" },
      { text: " three", kind: "context" },
      { text: "", kind: "context" }
    ]);
  });
});
