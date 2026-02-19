#!/usr/bin/env node

import { access } from "node:fs/promises";
import process from "node:process";

const preloadOutput = "dist/preload/index.js";

try {
  await access(preloadOutput);
} catch (error) {
  console.error(`[desktop:build-main] Missing preload output at ${preloadOutput}.`, error);
  process.exit(1);
}
