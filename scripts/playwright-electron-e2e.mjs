#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { _electron as electron } from "playwright-core";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rendererPort = process.env.KATA_CLOUD_E2E_PORT ?? "4174";
const rendererUrl = `http://127.0.0.1:${rendererPort}`;
const outputDir = path.join(process.cwd(), "output", "playwright");

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

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      const exitCode = normalizeExitCode(code, signal);
      if (exitCode !== 0) {
        reject(
          new Error(`${command} ${args.join(" ")} failed with exit code ${exitCode}.`)
        );
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
    console.error("[electron-e2e] Failed to start Vite.", error);
  });
}

function stopVite() {
  if (!viteProcess || viteProcess.killed) {
    return;
  }

  viteProcess.kill("SIGTERM");
}

async function setupRepo(repoPath) {
  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, "README.md"), "# Kata Cloud E2E\n", "utf8");
  await runProcess("git", ["init"], { cwd: repoPath });
  await runProcess("git", ["config", "user.name", "kata-e2e"], { cwd: repoPath });
  await runProcess("git", ["config", "user.email", "kata-e2e@example.com"], {
    cwd: repoPath
  });
  await runProcess("git", ["add", "README.md"], { cwd: repoPath });
  await runProcess("git", ["commit", "-m", "init"], { cwd: repoPath });

  // Unstaged change used to validate Changes flow without repoUrl metadata.
  await writeFile(
    path.join(repoPath, "README.md"),
    "# Kata Cloud E2E\n\nunstaged change\n",
    "utf8"
  );
}

async function setActiveSpace(page, repoPath, repoUrl) {
  await page.evaluate(
    async ({ nextRootPath, nextRepoUrl }) => {
      const shell = window.kataShell;
      if (!shell) {
        throw new Error("kataShell bridge unavailable.");
      }

      const current = await shell.getState();
      const activeSpaceId = current.activeSpaceId ?? current.spaces[0]?.id;
      if (!activeSpaceId) {
        throw new Error("No active space available.");
      }

      const now = new Date().toISOString();
      const nextSpaces = current.spaces.map((space) => {
        if (space.id !== activeSpaceId) {
          return space;
        }

        return {
          ...space,
          name: "Playwright E2E Space",
          rootPath: nextRootPath,
          repoUrl: nextRepoUrl || undefined,
          gitStatus: undefined,
          updatedAt: now
        };
      });

      await shell.saveState({
        ...current,
        activeView: "changes",
        spaces: nextSpaces,
        lastOpenedAt: now
      });
    },
    {
      nextRootPath: repoPath,
      nextRepoUrl: repoUrl ?? ""
    }
  );
}

async function assertChangesFlowWithoutRepoLink(page) {
  await page.getByRole("button", { name: "Changes", exact: true }).click();
  await page.getByRole("button", { name: "Refresh Changes", exact: true }).click();

  await page.waitForFunction(() => {
    const text = document.body.textContent ?? "";
    return /[1-9]\d* changed file\(s\)/.test(text);
  });

  const unavailableMessageVisible = await page
    .getByText("Git changes are unavailable in this runtime.")
    .isVisible()
    .catch(() => false);
  if (unavailableMessageVisible) {
    throw new Error("Renderer showed runtime-unavailable message under Electron.");
  }

  const legacyRepoLinkPromptVisible = await page
    .getByText("Link a repository when creating the space to enable git lifecycle actions.")
    .isVisible()
    .catch(() => false);
  if (legacyRepoLinkPromptVisible) {
    throw new Error("Legacy repo-link gating message is still visible.");
  }
}

async function assertPrRedaction(page, repoPath) {
  await writeFile(
    path.join(repoPath, "secrets.txt"),
    "token=sk-test-this-should-never-appear\n",
    "utf8"
  );
  await runProcess("git", ["add", "secrets.txt"], { cwd: repoPath });

  await page.getByRole("button", { name: "Refresh Changes", exact: true }).click();
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (item) => item.textContent?.trim() === "Generate PR Suggestion"
    );

    return Boolean(button && !button.disabled);
  });

  await page.getByRole("button", { name: "Generate PR Suggestion", exact: true }).click();
  await page.waitForFunction(() => {
    const bodyNode = document.querySelector("#pr-body-input");
    const body = bodyNode && "value" in bodyNode ? bodyNode.value : "";
    return Boolean(body && body.length > 0);
  });

  const prBody = await page.locator("#pr-body-input").inputValue();
  if (!prBody.includes("[diff preview suppressed: sensitive file path]")) {
    throw new Error("PR draft body did not include sensitive-path suppression marker.");
  }

  if (prBody.includes("sk-test-this-should-never-appear")) {
    throw new Error("PR draft body leaked sensitive token contents.");
  }
}

async function run() {
  const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), "kata-cloud-electron-e2e-"));
  let electronApp;

  try {
    const isolatedHome = path.join(sandboxRoot, "home");
    const isolatedConfig = path.join(sandboxRoot, "config");
    const repoPath = path.join(sandboxRoot, "repo");
    const screenshotPath = path.join(
      outputDir,
      `electron-e2e-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
    );

    await mkdir(isolatedHome, { recursive: true });
    await mkdir(isolatedConfig, { recursive: true });

    console.log("[electron-e2e] Building Electron main/preload bundle...");
    await runProcess(pnpmCommand, ["run", "desktop:build-main"]);

    console.log("[electron-e2e] Creating temporary git repository...");
    await setupRepo(repoPath);

    console.log(`[electron-e2e] Starting Vite on ${rendererUrl}...`);
    startVite();
    await waitForVite(rendererUrl);

    console.log("[electron-e2e] Launching Electron through Playwright...");
    electronApp = await electron.launch({
      args: ["dist/main/index.js"],
      env: {
        ...process.env,
        HOME: isolatedHome,
        XDG_CONFIG_HOME: isolatedConfig,
        KATA_CLOUD_RENDERER_URL: rendererUrl
      }
    });

    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");

    const bridgeType = await page.evaluate(() => typeof window.kataShell);
    if (bridgeType !== "object") {
      throw new Error(`Expected kataShell bridge object, got ${bridgeType}.`);
    }

    await setActiveSpace(page, repoPath, "");
    await assertChangesFlowWithoutRepoLink(page);

    await setActiveSpace(page, repoPath, "https://github.com/example/kata-cloud-e2e");
    await assertPrRedaction(page, repoPath);

    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log("[electron-e2e] PASS");
    console.log(`[electron-e2e] Screenshot: ${screenshotPath}`);
  } finally {
    await electronApp?.close().catch(() => undefined);
    stopVite();
    await rm(sandboxRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

run().catch((error) => {
  stopVite();
  console.error("[electron-e2e] FAIL", error);
  process.exit(1);
});
