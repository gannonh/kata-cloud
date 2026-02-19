#!/usr/bin/env node

import process from "node:process";
import { runElectronSuite } from "./playwright-electron-runner.mjs";

runElectronSuite({ suite: "smoke", label: "electron-smoke" }).catch((error) => {
  console.error("[electron-smoke] FAIL", error);
  process.exit(1);
});
