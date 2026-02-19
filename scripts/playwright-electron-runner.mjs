#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { _electron as electron } from "playwright-core";

const VALID_SUITES = new Set(["smoke", "uat", "full"]);

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rendererPort = process.env.KATA_CLOUD_E2E_PORT ?? process.env.KATA_CLOUD_UAT_PORT ?? "4174";
const rendererUrl = `http://127.0.0.1:${rendererPort}`;
const outputDir = path.join(process.cwd(), "output", "playwright");

let viteProcess;
let viteStartupError;

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
    if (viteStartupError) {
      throw viteStartupError;
    }

    if (viteProcess && viteProcess.exitCode !== null && viteProcess.exitCode !== 0) {
      throw new Error(`Vite exited before becoming ready (exit code ${viteProcess.exitCode}).`);
    }

    if (await pingVite(url)) {
      return;
    }
    await delay(200);
  }

  throw new Error(`Timed out waiting for Vite at ${url}`);
}

function startVite() {
  viteStartupError = null;
  viteProcess = spawn(
    pnpmCommand,
    ["exec", "vite", "--host", "127.0.0.1", "--port", rendererPort, "--strictPort"],
    {
      stdio: "inherit",
      env: process.env
    }
  );

  viteProcess.on("error", (error) => {
    viteStartupError = error;
    console.error("[electron-e2e] Failed to start Vite.", error);
  });
  viteProcess.on("exit", (code, signal) => {
    if (code !== null && code !== 0) {
      viteStartupError = new Error(
        `Vite exited unexpectedly with code ${code}${signal ? ` (signal: ${signal})` : ""}.`
      );
    }
  });
}

function stopVite() {
  if (!viteProcess || viteProcess.killed) {
    return;
  }

  viteProcess.kill("SIGTERM");
}

async function launchElectronApp(rendererAddress, isolatedHome, isolatedConfig) {
  const electronLaunchArgs = ["dist/main/index.js"];
  if (
    process.platform === "linux" &&
    (process.env.CI === "true" || process.env.KATA_CLOUD_ELECTRON_NO_SANDBOX === "1")
  ) {
    electronLaunchArgs.unshift("--disable-gpu");
    electronLaunchArgs.unshift("--no-sandbox");
  }

  return electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      HOME: isolatedHome,
      XDG_CONFIG_HOME: isolatedConfig,
      KATA_CLOUD_RENDERER_URL: rendererAddress
    }
  });
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
        activeView: "orchestrator",
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

async function assertBodyIncludes(page, expectedText, description = expectedText) {
  const found = await page
    .waitForFunction((needle) => (document.body.textContent ?? "").includes(needle), expectedText)
    .then(() => true)
    .catch(() => false);
  if (!found) {
    throw new Error(`Expected renderer output to include ${description}.`);
  }
}

async function assertBridgeAndChangesSmoke(page) {
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

  await page.getByRole("button", { name: "Changes", exact: true }).click();
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

async function getLatestRunSnapshot(page) {
  return page.evaluate(async () => {
    const shell = window.kataShell;
    if (!shell) {
      throw new Error("kataShell bridge unavailable.");
    }

    const state = await shell.getState();
    const runs = state.orchestratorRuns.filter(
      (run) => run.spaceId === state.activeSpaceId && run.sessionId === state.activeSessionId
    );
    const sortedRuns = [...runs].sort((leftRun, rightRun) => {
      if (rightRun.updatedAt !== leftRun.updatedAt) {
        return rightRun.updatedAt < leftRun.updatedAt ? -1 : 1;
      }
      if (rightRun.createdAt !== leftRun.createdAt) {
        return rightRun.createdAt < leftRun.createdAt ? -1 : 1;
      }
      return rightRun.id.localeCompare(leftRun.id);
    });

    const latestRun = sortedRuns[0];
    return {
      count: sortedRuns.length,
      latest: latestRun
        ? {
            id: latestRun.id,
            prompt: latestRun.prompt,
            status: latestRun.status,
            lifecycleText: latestRun.statusTimeline.join(" -> "),
            errorMessage: latestRun.errorMessage ?? null
          }
        : null
    };
  });
}

async function runOrchestratorPrompt(page, prompt, expectedStatus) {
  await page.getByRole("button", { name: "Orchestrator", exact: true }).click();
  await page.locator("#space-prompt-input").fill(prompt);

  const before = await getLatestRunSnapshot(page);
  await page.waitForFunction(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "Run Orchestrator"
    );
    return Boolean(button && !button.disabled);
  });
  await page.getByRole("button", { name: "Run Orchestrator", exact: true }).click();

  await page.waitForFunction(
    async ({ previousRunCount, targetStatus }) => {
      const shell = window.kataShell;
      if (!shell) {
        return false;
      }

      const state = await shell.getState();
      const runs = state.orchestratorRuns.filter(
        (run) => run.spaceId === state.activeSpaceId && run.sessionId === state.activeSessionId
      );
      if (runs.length <= previousRunCount) {
        return false;
      }

      const latestRun = [...runs].sort((leftRun, rightRun) => {
        if (rightRun.updatedAt !== leftRun.updatedAt) {
          return rightRun.updatedAt < leftRun.updatedAt ? -1 : 1;
        }
        if (rightRun.createdAt !== leftRun.createdAt) {
          return rightRun.createdAt < leftRun.createdAt ? -1 : 1;
        }
        return rightRun.id.localeCompare(leftRun.id);
      })[0];

      return Boolean(latestRun && latestRun.status === targetStatus);
    },
    {
      previousRunCount: before.count,
      targetStatus: expectedStatus
    }
  );

  const after = await getLatestRunSnapshot(page);
  const latestRun = after.latest;
  if (!latestRun) {
    throw new Error("Expected a latest run after orchestrator execution.");
  }
  if (latestRun.status !== expectedStatus) {
    throw new Error(`Expected latest run status ${expectedStatus}, received ${latestRun.status}.`);
  }
  if (latestRun.prompt !== prompt) {
    throw new Error("Latest run prompt did not match submitted prompt.");
  }

  return latestRun;
}

async function assertOrchestratorPhaseCoverage(page) {
  const completedPrompt = "Implement deterministic lifecycle transitions and verify visibility.";
  const failedPrompt = "Trigger fail diagnostics for this run fail.";
  const recoveryPrompt = "Recover safely after failures with stable run history.";
  const deterministicFailure =
    "Deterministic failure triggered by keyword \"fail\". Remove \"fail\" from the prompt and rerun.";

  const completedRun = await runOrchestratorPrompt(page, completedPrompt, "completed");
  await assertBodyIncludes(page, `Run ${completedRun.id} is Completed.`, "completed latest-run status");
  await assertBodyIncludes(page, "Lifecycle: queued -> running -> completed", "completed lifecycle text");

  const failedRun = await runOrchestratorPrompt(page, failedPrompt, "failed");
  await assertBodyIncludes(page, `Run ${failedRun.id} is Failed.`, "failed latest-run status");
  await assertBodyIncludes(page, "Lifecycle: queued -> running -> failed", "failed lifecycle text");
  await assertBodyIncludes(page, deterministicFailure, "deterministic failure message");

  const recoveredRun = await runOrchestratorPrompt(page, recoveryPrompt, "completed");
  await assertBodyIncludes(page, `Run ${recoveredRun.id} is Completed.`, "post-failure recovery status");
  await assertBodyIncludes(page, "Run History", "run history card");
  await assertBodyIncludes(page, failedRun.id, "failed run entry in history");
  await assertBodyIncludes(page, deterministicFailure, "failed diagnostics retained in history");

  return {
    latestCompletedRunId: recoveredRun.id,
    failedRunId: failedRun.id,
    deterministicFailure
  };
}

async function assertOrchestratorPersistenceAfterRestart(page, coverageEvidence) {
  await page.getByRole("button", { name: "Orchestrator", exact: true }).click();
  await page.waitForFunction(
    async ({ latestCompletedRunId, failedRunId }) => {
      const shell = window.kataShell;
      if (!shell) {
        return false;
      }

      const state = await shell.getState();
      const runs = state.orchestratorRuns.filter(
        (run) => run.spaceId === state.activeSpaceId && run.sessionId === state.activeSessionId
      );
      if (runs.length < 3) {
        return false;
      }

      const latestRun = [...runs].sort((leftRun, rightRun) => {
        if (rightRun.updatedAt !== leftRun.updatedAt) {
          return rightRun.updatedAt < leftRun.updatedAt ? -1 : 1;
        }
        if (rightRun.createdAt !== leftRun.createdAt) {
          return rightRun.createdAt < leftRun.createdAt ? -1 : 1;
        }
        return rightRun.id.localeCompare(leftRun.id);
      })[0];
      const failedRun = runs.find((run) => run.id === failedRunId);

      return Boolean(
        latestRun &&
          latestRun.id === latestCompletedRunId &&
          latestRun.status === "completed" &&
          failedRun &&
          failedRun.status === "failed"
      );
    },
    {
      latestCompletedRunId: coverageEvidence.latestCompletedRunId,
      failedRunId: coverageEvidence.failedRunId
    }
  );

  await assertBodyIncludes(page, `Run ${coverageEvidence.latestCompletedRunId} is Completed.`);
  await assertBodyIncludes(page, coverageEvidence.failedRunId, "failed run id after restart");
  await assertBodyIncludes(page, coverageEvidence.deterministicFailure, "failed diagnostics after restart");
}

function includesScenario(suite, tags) {
  if (suite === "full") {
    return true;
  }

  return tags.includes(suite);
}

function parseSuiteFromArgv(argv) {
  let suite;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--suite") {
      suite = argv[index + 1];
      index += 1;
      continue;
    }

    if (typeof arg === "string" && arg.startsWith("--suite=")) {
      suite = arg.slice("--suite=".length);
    }
  }

  const normalized = (suite ?? "full").trim().toLowerCase();
  if (!VALID_SUITES.has(normalized)) {
    throw new Error(`Invalid suite "${suite}". Use one of: smoke, uat, full.`);
  }

  return normalized;
}

export async function runElectronSuite({ suite = "full", label } = {}) {
  const normalizedSuite = suite.trim().toLowerCase();
  if (!VALID_SUITES.has(normalizedSuite)) {
    throw new Error(`Invalid suite "${suite}". Use one of: smoke, uat, full.`);
  }

  const logPrefix = label ?? `electron-${normalizedSuite}`;
  const scenarios = [
    {
      id: "bridge-smoke",
      tags: ["smoke"],
      requiresRepo: false,
      run: async (context) => {
        await assertBridgeAndChangesSmoke(context.page);
      }
    },
    {
      id: "orchestrator-uat-lifecycle-persistence",
      tags: ["uat"],
      requiresRepo: true,
      run: async (context) => {
        await setActiveSpace(context.page, context.repoPath, "");
        const coverageEvidence = await assertOrchestratorPhaseCoverage(context.page);
        await context.relaunch();
        await assertOrchestratorPersistenceAfterRestart(context.page, coverageEvidence);
      }
    },
    {
      id: "changes-no-repo-link-uat",
      tags: ["uat"],
      requiresRepo: true,
      run: async (context) => {
        await setActiveSpace(context.page, context.repoPath, "");
        await assertChangesFlowWithoutRepoLink(context.page);
      }
    },
    {
      id: "pr-redaction-uat",
      tags: ["uat"],
      requiresRepo: true,
      run: async (context) => {
        await setActiveSpace(context.page, context.repoPath, "https://github.com/example/kata-cloud-e2e");
        await assertPrRedaction(context.page, context.repoPath);
      }
    }
  ].filter((scenario) => includesScenario(normalizedSuite, scenario.tags));

  if (scenarios.length === 0) {
    throw new Error(`No scenarios selected for suite "${normalizedSuite}".`);
  }

  const sandboxRoot = await mkdtemp(path.join(os.tmpdir(), "kata-cloud-electron-e2e-"));
  let electronApp;

  try {
    const isolatedHome = path.join(sandboxRoot, "home");
    const isolatedConfig = path.join(sandboxRoot, "config");
    const repoPath = path.join(sandboxRoot, "repo");
    const screenshotPath = path.join(
      outputDir,
      `${logPrefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
    );

    await mkdir(isolatedHome, { recursive: true });
    await mkdir(isolatedConfig, { recursive: true });

    console.log(`[${logPrefix}] Building Electron main/preload bundle...`);
    await runProcess(pnpmCommand, ["run", "desktop:build-main"]);

    if (scenarios.some((scenario) => scenario.requiresRepo)) {
      console.log(`[${logPrefix}] Creating temporary git repository...`);
      await setupRepo(repoPath);
    }

    console.log(`[${logPrefix}] Starting Vite on ${rendererUrl}...`);
    startVite();
    await waitForVite(rendererUrl);

    console.log(`[${logPrefix}] Launching Electron through Playwright...`);

    let page;
    const relaunch = async () => {
      await electronApp?.close();
      electronApp = await launchElectronApp(rendererUrl, isolatedHome, isolatedConfig);
      page = await electronApp.firstWindow();
      await page.waitForLoadState("domcontentloaded");

      const bridgeType = await page.evaluate(() => typeof window.kataShell);
      if (bridgeType !== "object") {
        throw new Error(`Expected kataShell bridge object, got ${bridgeType}.`);
      }

      return page;
    };

    await relaunch();

    const context = {
      get page() {
        return page;
      },
      repoPath,
      relaunch
    };

    for (const scenario of scenarios) {
      console.log(`[${logPrefix}] Scenario: ${scenario.id}`);
      await scenario.run(context);
      console.log(`[${logPrefix}] Scenario passed: ${scenario.id}`);
    }

    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`[${logPrefix}] PASS`);
    console.log(`[${logPrefix}] Screenshot: ${screenshotPath}`);
  } finally {
    await electronApp?.close().catch(() => undefined);
    stopVite();
    await rm(sandboxRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const suite = parseSuiteFromArgv(process.argv.slice(2));
  runElectronSuite({ suite }).catch((error) => {
    stopVite();
    console.error(`[electron-${suite}] FAIL`, error);
    process.exit(1);
  });
}
