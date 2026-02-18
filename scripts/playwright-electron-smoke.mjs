#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { _electron as electron } from "playwright-core";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rendererPort = process.env.KATA_CLOUD_UAT_PORT ?? "4173";
const rendererUrl = `http://127.0.0.1:${rendererPort}`;
const outputDir = path.join(process.cwd(), "output", "playwright");
const screenshotPath = path.join(
  outputDir,
  `electron-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
);

let viteProcess;

function normalizeExitCode(code, signal) {
  if (typeof code === "number") {
    return code;
  }

  if (signal === "SIGINT") {
    return 130;
  }

  if (signal === "SIGTERM") {
    return 143;
  }

  return 1;
}

function runPnpm(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmCommand, args, {
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      const exitCode = normalizeExitCode(code, signal);
      if (exitCode !== 0) {
        reject(new Error(`${label} failed with exit code ${exitCode}.`));
        return;
      }

      resolve();
    });
  });
}

function pingVite(url) {
  return new Promise((resolve) => {
    const pingUrl = new URL("/__vite_ping", url);
    const request = httpRequest(
      {
        hostname: pingUrl.hostname,
        port: pingUrl.port,
        path: pingUrl.pathname,
        method: "GET",
        timeout: 1000
      },
      (response) => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 300);
      }
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });

    request.on("error", () => {
      resolve(false);
    });

    request.end();
  });
}

async function waitForVite(url) {
  const timeoutMs = 30000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await pingVite(url)) {
      return;
    }
    await delay(200);
  }

  throw new Error(`Timed out waiting for Vite at ${url}`);
}

function startVite() {
  viteProcess = spawn(
    pnpmCommand,
    ["exec", "vite", "--host", "127.0.0.1", "--port", rendererPort, "--strictPort"],
    {
      stdio: "inherit",
      env: process.env
    }
  );

  viteProcess.on("error", (error) => {
    console.error("[electron-smoke] Failed to start Vite.", error);
  });
}

function stopVite() {
  if (!viteProcess || viteProcess.killed) {
    return;
  }

  viteProcess.kill("SIGTERM");
}

async function run() {
  console.log("[electron-smoke] Building Electron main/preload bundle...");
  await runPnpm(["run", "desktop:build-main"], "desktop:build-main");

  console.log(`[electron-smoke] Starting Vite on ${rendererUrl}...`);
  startVite();
  await waitForVite(rendererUrl);

  console.log("[electron-smoke] Launching Electron through Playwright...");
  const electronApp = await electron.launch({
    args: ["dist/main/index.js"],
    env: {
      ...process.env,
      KATA_CLOUD_RENDERER_URL: rendererUrl
    }
  });

  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");

    const bridgeStatus = await page.evaluate(() => {
      const shell = window.kataShell;
      const requiredMethods = [
        "getState",
        "saveState",
        "getSpaceChanges",
        "getSpaceFileDiff",
        "stageSpaceFile",
        "unstageSpaceFile",
        "generatePullRequestDraft"
      ];

      if (!shell || typeof shell !== "object") {
        return {
          bridgeType: typeof shell,
          missingMethods: requiredMethods
        };
      }

      return {
        bridgeType: typeof shell,
        missingMethods: requiredMethods.filter((methodName) => typeof shell[methodName] !== "function")
      };
    });

    if (bridgeStatus.bridgeType !== "object" || bridgeStatus.missingMethods.length > 0) {
      throw new Error(
        `kataShell bridge invalid. type=${bridgeStatus.bridgeType} missing=${bridgeStatus.missingMethods.join(",")}`
      );
    }

    await page.getByRole("button", { name: "Changes", exact: true }).click();
    await page.waitForTimeout(300);

    const runtimeMessageVisible = await page
      .getByText("Git changes are unavailable in this runtime.")
      .isVisible()
      .catch(() => false);
    if (runtimeMessageVisible) {
      throw new Error("Changes view rendered runtime-unavailable message inside Electron.");
    }

    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log("[electron-smoke] PASS");
    console.log(`[electron-smoke] Screenshot: ${screenshotPath}`);
  } finally {
    await electronApp.close().catch(() => undefined);
    stopVite();
  }
}

run().catch((error) => {
  stopVite();
  console.error("[electron-smoke] FAIL", error);
  process.exit(1);
});
