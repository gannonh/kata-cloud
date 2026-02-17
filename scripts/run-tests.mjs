#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const passthroughArgs = process.argv.slice(2);
const suite = passthroughArgs.find((arg) => !arg.startsWith("-"));

let target = "test";
if (suite === "notes") {
  target = "test/notes";
} else if (suite) {
  target = suite;
}

const result = spawnSync(process.execPath, ["--test", target], {
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
