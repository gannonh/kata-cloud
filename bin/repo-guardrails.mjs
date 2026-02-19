#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const simulatedPaths = args
  .filter((arg) => arg.startsWith("--path="))
  .map((arg) => arg.slice("--path=".length))
  .filter(Boolean);

const FORBIDDEN_MATCHERS = [
  {
    label: "macOS metadata",
    test: (path) => /(^|\/)\.DS_Store$/.test(path)
  },
  {
    label: "pnpm store cache",
    test: (path) => /(^|\/)\.pnpm-store(\/|$)/.test(path)
  },
  {
    label: "electron cache",
    test: (path) => /(^|\/)\.electron-cache(\/|$)/.test(path)
  },
  {
    label: "generic cache directory",
    test: (path) => /(^|\/)\.cache(\/|$)/.test(path)
  },
  {
    label: "coverage artifacts",
    test: (path) => /(^|\/)coverage(\/|$)/.test(path)
  },
  {
    label: "TypeScript incremental build output",
    test: (path) => /\.tsbuildinfo$/.test(path)
  }
];

function runGit(argsToRun) {
  const result = spawnSync("git", argsToRun, {
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git command failed").trim());
  }

  return result.stdout.trim();
}

function parseLines(output) {
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function classifyPath(path) {
  for (const matcher of FORBIDDEN_MATCHERS) {
    if (matcher.test(path)) {
      return matcher.label;
    }
  }

  return undefined;
}

const trackedPaths = parseLines(runGit(["ls-files"]));
const stagedPaths = parseLines(runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]));
const allPaths = new Set([...trackedPaths, ...stagedPaths, ...simulatedPaths]);

const violations = [];
for (const path of allPaths) {
  const reason = classifyPath(path);
  if (!reason) {
    continue;
  }

  violations.push({ path, reason });
}

if (violations.length === 0) {
  console.log("[repo-guardrails] PASS: no forbidden artifact paths found.");
  process.exit(0);
}

console.error("[repo-guardrails] FAIL: forbidden artifact paths detected.");
for (const violation of violations) {
  console.error(` - ${violation.path} (${violation.reason})`);
}

if (dryRun) {
  console.log("[repo-guardrails] DRY-RUN: exiting 0 for simulation mode.");
  process.exit(0);
}

process.exit(1);
