#!/usr/bin/env node

import { copyFile, rm } from "node:fs/promises";
import process from "node:process";

const source = "dist/preload-cjs/preload/index.js";
const target = "dist/preload/index.cjs";

try {
  await copyFile(source, target);
  await rm("dist/preload-cjs", { recursive: true, force: true });
} catch (error) {
  console.error(`[desktop:build-main] Unable to create ${target} from ${source}.`, error);
  process.exit(1);
}
