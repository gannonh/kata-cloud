#!/usr/bin/env node

import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const rendererStartPort = "5173";

let viteProcess;
let electronProcess;
let shuttingDown = false;
let viteStdoutBuffer = "";
let viteStderrBuffer = "";
let isLaunchingElectron = false;

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

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

function killProcess(childProcess) {
  if (!childProcess || childProcess.killed) {
    return;
  }

  childProcess.kill("SIGTERM");
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killProcess(electronProcess);
  killProcess(viteProcess);

  setTimeout(() => {
    process.exit(exitCode);
  }, 100).unref();
}

function runBuildMain() {
  return new Promise((resolve, reject) => {
    const buildProcess = spawn(pnpmCommand, ["run", "desktop:build-main"], {
      stdio: "inherit",
      env: process.env
    });

    buildProcess.on("error", reject);
    buildProcess.on("exit", (code, signal) => {
      const exitCode = normalizeExitCode(code, signal);
      if (exitCode !== 0) {
        process.exit(exitCode);
        return;
      }
      resolve();
    });
  });
}

function pingVite(url) {
  return new Promise((resolve) => {
    const pingUrl = new URL("/__vite_ping", url);
    const req = httpRequest(
      {
        hostname: pingUrl.hostname,
        port: pingUrl.port,
        path: pingUrl.pathname,
        method: "GET",
        timeout: 1000
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => {
      resolve(false);
    });

    req.end();
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

function parseRendererUrl(line) {
  const normalized = stripAnsi(line);
  if (!normalized.includes("Local:")) {
    return undefined;
  }

  const match = normalized.match(/https?:\/\/[^\s]+/);
  if (!match) {
    return undefined;
  }

  return match[0].replace(/\/$/, "");
}

async function launchElectron(rendererUrl) {
  if (isLaunchingElectron || electronProcess) {
    return;
  }

  isLaunchingElectron = true;
  try {
    await waitForVite(rendererUrl);
  } catch (error) {
    console.error("[dev] Renderer did not become ready.", error);
    shutdown(1);
    return;
  } finally {
    isLaunchingElectron = false;
  }

  console.log(`[dev] Launching Electron with renderer URL: ${rendererUrl}`);
  electronProcess = spawn(pnpmCommand, ["exec", "electron", "dist/main/index.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      KATA_CLOUD_RENDERER_URL: rendererUrl
    }
  });

  electronProcess.on("error", (error) => {
    console.error("[dev] Failed to launch Electron.", error);
    shutdown(1);
  });

  electronProcess.on("exit", (code, signal) => {
    const exitCode = normalizeExitCode(code, signal);
    shutdown(exitCode);
  });
}

function consumeViteOutput(buffer, chunk, target) {
  const text = chunk.toString();
  target.write(text);
  buffer += text;

  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex);
    const rendererUrl = parseRendererUrl(line);
    if (rendererUrl) {
      void launchElectron(rendererUrl);
    }
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\n");
  }

  return buffer;
}

function startVite() {
  viteProcess = spawn(
    pnpmCommand,
    ["exec", "vite", "--host", "127.0.0.1", "--port", rendererStartPort],
    {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env
    }
  );

  viteProcess.stdout.on("data", (chunk) => {
    viteStdoutBuffer = consumeViteOutput(viteStdoutBuffer, chunk, process.stdout);
  });

  viteProcess.stderr.on("data", (chunk) => {
    viteStderrBuffer = consumeViteOutput(viteStderrBuffer, chunk, process.stderr);
  });

  viteProcess.on("error", (error) => {
    console.error("[dev] Failed to launch Vite.", error);
    shutdown(1);
  });

  viteProcess.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const exitCode = normalizeExitCode(code, signal);
    if (!electronProcess) {
      process.exit(exitCode);
      return;
    }

    console.error("[dev] Vite exited while Electron was running.");
    shutdown(exitCode);
  });
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

await runBuildMain();
startVite();
