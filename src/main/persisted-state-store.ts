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

  private async writeToDisk(nextState: AppState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    await writeFile(this.statePath, JSON.stringify(nextState, null, 2), "utf8");
  }
}
