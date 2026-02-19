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
const ORCHESTRATOR_RUN_HELPERS_KEY = "__kataCloudOrchestratorRunHelpers";

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
      KATA_CLOUD_RENDERER_URL: rendererAddress,
      KATA_CLOUD_E2E_PROVIDER_STUB: process.env.KATA_CLOUD_E2E_PROVIDER_STUB ?? "1"
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

async function setActiveContextProvider(page, providerId) {
  await page.evaluate(
    async (nextProviderId) => {
      const shell = window.kataShell;
      if (!shell) {
        throw new Error("kataShell bridge unavailable.");
      }

      const current = await shell.getState();
      const activeSpaceId = current.activeSpaceId ?? current.spaces[0]?.id;
      if (!activeSpaceId) {
        throw new Error("No active space available.");
      }

      const activeSessionId =
        current.activeSessionId ??
        current.sessions.find((session) => session.spaceId === activeSpaceId)?.id;
      const now = new Date().toISOString();
      const nextSpaces = current.spaces.map((space) =>
        space.id === activeSpaceId
          ? {
              ...space,
              contextProvider: nextProviderId,
              updatedAt: now
            }
          : space
      );
      const nextSessions = current.sessions.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              contextProvider: nextProviderId,
              updatedAt: now
            }
          : session
      );

      await shell.saveState({
        ...current,
        activeView: "orchestrator",
        spaces: nextSpaces,
        sessions: nextSessions,
        lastOpenedAt: now
      });
    },
    providerId
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

async function ensureOrchestratorRunHelpers(page) {
  await page.evaluate((helpersKey) => {
    if (window[helpersKey]) {
      return;
    }

    const sortRunsByRecency = (runs) =>
      [...runs].sort((leftRun, rightRun) => {
        if (rightRun.updatedAt !== leftRun.updatedAt) {
          return rightRun.updatedAt < leftRun.updatedAt ? -1 : 1;
        }
        if (rightRun.createdAt !== leftRun.createdAt) {
          return rightRun.createdAt < leftRun.createdAt ? -1 : 1;
        }
        return rightRun.id.localeCompare(leftRun.id);
      });

    const projectRunSnapshot = (run) => {
      if (!run) {
        return null;
      }

      return {
        id: run.id,
        prompt: run.prompt,
        status: run.status,
        lifecycleText: run.statusTimeline.join(" -> "),
        errorMessage: run.errorMessage ?? null,
        contextRetrievalError: run.contextRetrievalError
          ? {
              code: run.contextRetrievalError.code,
              message: run.contextRetrievalError.message,
              remediation: run.contextRetrievalError.remediation,
              retryable: run.contextRetrievalError.retryable,
              providerId: run.contextRetrievalError.providerId
            }
          : null
      };
    };

    const getRunsForActiveContext = (state) =>
      state.orchestratorRuns.filter(
        (run) => run.spaceId === state.activeSpaceId && run.sessionId === state.activeSessionId
      );

    window[helpersKey] = {
      sortRunsByRecency,
      projectRunSnapshot,
      getRunsForActiveContext
    };
  }, ORCHESTRATOR_RUN_HELPERS_KEY);
}

async function getRunSnapshot(page, targetPrompt = null) {
  await ensureOrchestratorRunHelpers(page);

  return page.evaluate(async ({ helpersKey, prompt }) => {
    const shell = window.kataShell;
    if (!shell) {
      throw new Error("kataShell bridge unavailable.");
    }

    const helpers = window[helpersKey];
    if (!helpers) {
      throw new Error("Orchestrator run helpers unavailable.");
    }

    const state = await shell.getState();
    const allRuns = helpers.getRunsForActiveContext(state);
    const runs =
      typeof prompt === "string"
        ? allRuns.filter((run) => run.prompt === prompt)
        : allRuns;
    const sortedRuns = helpers.sortRunsByRecency(runs);
    const latestRun = sortedRuns[0];

    return {
      count: sortedRuns.length,
      latest: helpers.projectRunSnapshot(latestRun)
    };
  }, {
    helpersKey: ORCHESTRATOR_RUN_HELPERS_KEY,
    prompt: targetPrompt
  });
}

async function getLatestRunSnapshot(page) {
  return getRunSnapshot(page);
}

async function runOrchestratorPrompt(page, prompt, expectedStatus) {
  await ensureOrchestratorRunHelpers(page);

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
    async ({ previousRunCount, targetStatus, targetPrompt, helpersKey }) => {
      const shell = window.kataShell;
      if (!shell) {
        throw new Error("kataShell bridge unavailable.");
      }

      const helpers = window[helpersKey];
      if (!helpers) {
        throw new Error("Orchestrator run helpers unavailable.");
      }

      const state = await shell.getState();
      const runs = helpers.getRunsForActiveContext(state);
      if (runs.length <= previousRunCount) {
        return false;
      }

      const matchingRuns = runs.filter((run) => run.prompt === targetPrompt);
      if (matchingRuns.length === 0) {
        return false;
      }

      const latestMatchingRun = helpers.sortRunsByRecency(matchingRuns)[0];

      return Boolean(latestMatchingRun && latestMatchingRun.status === targetStatus);
    },
    {
      previousRunCount: before.count,
      targetStatus: expectedStatus,
      targetPrompt: prompt,
      helpersKey: ORCHESTRATOR_RUN_HELPERS_KEY
    }
  );

  const matchingRunSnapshot = await getRunSnapshot(page, prompt);
  const matchingRun = matchingRunSnapshot.latest;

  if (!matchingRun) {
    throw new Error(`Expected run for prompt "${prompt}" after orchestrator execution.`);
  }
  if (matchingRun.status !== expectedStatus) {
    throw new Error(
      `Expected run status ${expectedStatus}, received ${matchingRun.status}. Lifecycle: ${matchingRun.lifecycleText}. Error: ${matchingRun.errorMessage ?? "none"}.`
    );
  }

  return matchingRun;
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
  await ensureOrchestratorRunHelpers(page);

  await page.getByRole("button", { name: "Orchestrator", exact: true }).click();
  await page.waitForFunction(
    async ({ latestCompletedRunId, failedRunId, helpersKey }) => {
      const shell = window.kataShell;
      if (!shell) {
        return false;
      }

      const helpers = window[helpersKey];
      if (!helpers) {
        return false;
      }

      const state = await shell.getState();
      const runs = helpers.getRunsForActiveContext(state);
      if (runs.length < 3) {
        return false;
      }

      const latestRun = helpers.sortRunsByRecency(runs)[0];
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
      failedRunId: coverageEvidence.failedRunId,
      helpersKey: ORCHESTRATOR_RUN_HELPERS_KEY
    }
  );

  await assertBodyIncludes(page, `Run ${coverageEvidence.latestCompletedRunId} is Completed.`);
  await assertBodyIncludes(page, coverageEvidence.failedRunId, "failed run id after restart");
  await assertBodyIncludes(page, coverageEvidence.deterministicFailure, "failed diagnostics after restart");
}

async function assertOrchestratorContextDiagnostics(page) {
  const mcpPrompt = "Capture context diagnostics with mcp provider unavailable.";
  const filesystemPrompt = "Run after diagnostics using filesystem context provider.";
  const contextDiagnosticText =
    "Context (mcp / provider_unavailable): MCP context provider is not yet connected.";
  const remediationText = "Remediation: Configure the MCP provider runtime before requesting MCP context.";

  await setActiveContextProvider(page, "mcp");
  const diagnosticRun = await runOrchestratorPrompt(page, mcpPrompt, "completed");

  const latestWithDiagnostic = await getLatestRunSnapshot(page);
  if (latestWithDiagnostic.latest?.id !== diagnosticRun.id) {
    throw new Error("Expected diagnostic run to remain latest during diagnostics validation.");
  }
  if (!latestWithDiagnostic.latest?.contextRetrievalError) {
    throw new Error("Expected latest run to persist context retrieval diagnostics.");
  }
  if (latestWithDiagnostic.latest.contextRetrievalError.code !== "provider_unavailable") {
    throw new Error(
      "Expected context retrieval diagnostic code provider_unavailable for MCP run."
    );
  }
  if (latestWithDiagnostic.latest.contextRetrievalError.providerId !== "mcp") {
    throw new Error("Expected context retrieval diagnostic provider mcp.");
  }

  await assertBodyIncludes(page, `Run ${diagnosticRun.id} is Completed.`);
  await assertBodyIncludes(page, contextDiagnosticText, "latest-run context diagnostic text");
  await assertBodyIncludes(page, remediationText, "latest-run remediation text");
  await assertBodyIncludes(page, "(retryable)", "context diagnostic retryability marker");

  await setActiveContextProvider(page, "filesystem");
  const postDiagnosticRun = await runOrchestratorPrompt(page, filesystemPrompt, "completed");
  const latestWithoutDiagnostic = await getLatestRunSnapshot(page);
  if (latestWithoutDiagnostic.latest?.id !== postDiagnosticRun.id) {
    throw new Error("Expected filesystem run to become latest run.");
  }
  if (latestWithoutDiagnostic.latest.contextRetrievalError) {
    throw new Error("Expected filesystem run to complete without context diagnostics.");
  }

  await assertBodyIncludes(page, "Run History", "run history card");
  await assertBodyIncludes(page, diagnosticRun.id, "diagnostic run id in history");
  await assertBodyIncludes(page, contextDiagnosticText, "historical context diagnostic text");

  return {
    latestRunId: postDiagnosticRun.id,
    diagnosticRunId: diagnosticRun.id,
    contextDiagnosticText
  };
}

async function assertOrchestratorContextDiagnosticsPersistenceAfterRestart(page, coverageEvidence) {
  await ensureOrchestratorRunHelpers(page);

  await page.getByRole("button", { name: "Orchestrator", exact: true }).click();
  await page.waitForFunction(
    async ({ latestRunId, diagnosticRunId, helpersKey }) => {
      const shell = window.kataShell;
      if (!shell) {
        return false;
      }

      const helpers = window[helpersKey];
      if (!helpers) {
        return false;
      }

      const state = await shell.getState();
      const runs = helpers.getRunsForActiveContext(state);
      if (runs.length < 2) {
        return false;
      }

      const latestRun = helpers.sortRunsByRecency(runs)[0];

      const diagnosticRun = runs.find((run) => run.id === diagnosticRunId);
      return Boolean(
        latestRun &&
          latestRun.id === latestRunId &&
          latestRun.status === "completed" &&
          !latestRun.contextRetrievalError &&
          diagnosticRun &&
          diagnosticRun.contextRetrievalError &&
          diagnosticRun.contextRetrievalError.code === "provider_unavailable" &&
          diagnosticRun.contextRetrievalError.providerId === "mcp"
      );
    },
    {
      latestRunId: coverageEvidence.latestRunId,
      diagnosticRunId: coverageEvidence.diagnosticRunId,
      helpersKey: ORCHESTRATOR_RUN_HELPERS_KEY
    }
  );

  await assertBodyIncludes(page, coverageEvidence.diagnosticRunId, "diagnostic run id after restart");
  await assertBodyIncludes(
    page,
    coverageEvidence.contextDiagnosticText,
    "historical context diagnostics after restart"
  );
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
      id: "orchestrator-context-diagnostics-uat",
      tags: ["uat"],
      requiresRepo: true,
      run: async (context) => {
        await setActiveSpace(context.page, context.repoPath, "");
        // Run lifecycle coverage as a precondition; persisted runs from this phase remain after relaunch
        // but do not interfere with context diagnostics because runOrchestratorPrompt matches by prompt text.
        let lifecycleEvidence;
        try {
          lifecycleEvidence = await assertOrchestratorPhaseCoverage(context.page);
        } catch (err) {
          throw new Error(`Lifecycle precondition failed before context diagnostics: ${err.message}`);
        }
        await context.relaunch();
        await assertOrchestratorPersistenceAfterRestart(context.page, lifecycleEvidence);
        const coverageEvidence = await assertOrchestratorContextDiagnostics(context.page);
        await context.relaunch();
        await assertOrchestratorContextDiagnosticsPersistenceAfterRestart(
          context.page,
          coverageEvidence
        );
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
