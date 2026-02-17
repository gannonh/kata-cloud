import { describe, expect, it } from "vitest";
import {
  isStagedFileChange,
  isUnstagedFileChange,
  parseGitStatusPorcelain,
  summarizeStagedChanges
} from "./changes";

describe("parseGitStatusPorcelain", () => {
  it("parses staged, unstaged, untracked, and rename entries", () => {
    const output = [
      "M  src/staged.ts",
      "MM src/partial.ts",
      " D src/removed.ts",
      "?? src/new.ts",
      "R  src/old-name.ts -> src/new-name.ts",
      "UU src/conflict.ts"
    ].join("\n");

    const changes = parseGitStatusPorcelain(output);

    expect(changes).toHaveLength(6);
    expect(changes[0]).toMatchObject({
      path: "src/staged.ts",
      stagedStatus: "M",
      unstagedStatus: null
    });
    expect(changes[1]).toMatchObject({
      path: "src/partial.ts",
      stagedStatus: "M",
      unstagedStatus: "M"
    });
    expect(changes[2]).toMatchObject({
      path: "src/removed.ts",
      stagedStatus: null,
      unstagedStatus: "D"
    });
    expect(changes[3]).toMatchObject({
      path: "src/new.ts",
      stagedStatus: null,
      unstagedStatus: "?"
    });
    expect(changes[4]).toMatchObject({
      path: "src/new-name.ts",
      previousPath: "src/old-name.ts",
      stagedStatus: "R"
    });
    expect(changes[5]).toMatchObject({
      path: "src/conflict.ts",
      isConflicted: true
    });
    expect(isStagedFileChange(changes[0]!)).toBe(true);
    expect(isUnstagedFileChange(changes[0]!)).toBe(false);
    expect(isStagedFileChange(changes[5]!)).toBe(true);
    expect(isUnstagedFileChange(changes[5]!)).toBe(true);
  });

  it("decodes quoted and octal-escaped rename paths", () => {
    const output = String.raw`R  "src/ol\303\251.ts" -> "src/ne\303\251 name.ts"`;

    const changes = parseGitStatusPorcelain(output);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      previousPath: "src/olé.ts",
      path: "src/neé name.ts"
    });
  });
});

describe("summarizeStagedChanges", () => {
  it("computes staged file counts and line deltas from numstat", () => {
    const files = parseGitStatusPorcelain(
      ["M  src/staged.ts", "A  src/new.ts", " D src/removed.ts", "R  old.ts -> new.ts"].join(
        "\n"
      )
    );
    const stagedNumstat = ["5\t2\tsrc/staged.ts", "12\t0\tsrc/new.ts", "1\t1\tnew.ts"].join("\n");

    const summary = summarizeStagedChanges(files, stagedNumstat);

    expect(summary).toEqual({
      fileCount: 3,
      added: 1,
      modified: 1,
      deleted: 0,
      renamed: 1,
      copied: 0,
      conflicted: 0,
      insertions: 18,
      deletions: 3
    });
  });

  it("ignores numstat rows that do not match staged files", () => {
    const files = parseGitStatusPorcelain(["M  src/staged.ts"].join("\n"));
    const stagedNumstat = ["9\t2\tsrc/staged.ts", "4\t4\tsrc/other.ts"].join("\n");

    const summary = summarizeStagedChanges(files, stagedNumstat);

    expect(summary.insertions).toBe(9);
    expect(summary.deletions).toBe(2);
  });
});
