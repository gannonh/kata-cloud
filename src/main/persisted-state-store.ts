import { app } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { AppState, createInitialAppState, normalizeAppState } from "../shared/state";

const STATE_FILENAME = "kata-cloud-state.json";

export class PersistedStateStore {
  private state: AppState = createInitialAppState();
  private readonly statePath: string;

  constructor(private readonly onStateChanged?: (nextState: AppState) => void) {
    this.statePath = path.join(app.getPath("userData"), STATE_FILENAME);
  }

  async initialize(): Promise<AppState> {
    this.state = await this.readFromDisk();
    await this.recoverInterruptedRuns();
    return this.state;
  }

  getState(): AppState {
    return this.state;
  }

  async save(nextState: unknown): Promise<AppState> {
    const merged = normalizeAppState(nextState);
    merged.lastOpenedAt = new Date().toISOString();
    this.state = merged;
    await this.writeToDisk(merged);
    this.onStateChanged?.(merged);
    return merged;
  }

  private async readFromDisk(): Promise<AppState> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return normalizeAppState(JSON.parse(raw));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "ENOENT") {
        console.error("Failed reading persisted state, falling back to defaults.", error);
      }

      const fallback = createInitialAppState();
      await this.writeToDisk(fallback);
      return fallback;
    }
  }

  private async recoverInterruptedRuns(): Promise<void> {
    const now = new Date().toISOString();
    const runs = this.state.orchestratorRuns;
    const hasInFlightRun = runs.some((run) => run.status === "queued" || run.status === "running");
    if (!hasInFlightRun) {
      return;
    }

    const recoveredRuns = runs.map((run) =>
      run.status === "queued" || run.status === "running"
        ? {
            // Recovery operates on persisted snapshots before the runtime is rehydrated,
            // so we mark in-flight runs directly instead of replaying lifecycle transitions.
            ...run,
            status: "interrupted" as const,
            statusTimeline: [...run.statusTimeline, "interrupted" as const],
            interruptedAt: now,
            updatedAt: now
          }
        : run
    );
    this.state = { ...this.state, orchestratorRuns: recoveredRuns };
    await this.writeToDisk(this.state);
  }

  private async writeToDisk(nextState: AppState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(nextState, null, 2), "utf8");
  }
}
