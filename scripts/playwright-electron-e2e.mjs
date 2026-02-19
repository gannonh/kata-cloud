#!/usr/bin/env node

import process from "node:process";
import { runElectronSuite } from "./playwright-electron-runner.mjs";

runElectronSuite({ suite: "uat", label: "electron-e2e" }).catch((error) => {
  console.error("[electron-e2e] FAIL", error);
  process.exit(1);
});
