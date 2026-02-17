import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { AppState } from "../shared/state";
import { IPC_CHANNELS } from "../shared/shell-api";
import { PersistedStateStore } from "./persisted-state-store";
import { SpaceGitLifecycleService } from "../git/space-git-service";
import type {
  SpaceGitChangesRequest,
  SpaceGitFileDiffRequest,
  SpaceGitFileRequest,
  SpaceGitLifecycleRequest
} from "../git/types";

let stateStore: PersistedStateStore | undefined;

function broadcastState(nextState: AppState): void {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    browserWindow.webContents.send(IPC_CHANNELS.stateChanged, nextState);
  }
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: "Kata Cloud",
    backgroundColor: "#0f1116",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const rendererDevUrl = process.env.KATA_CLOUD_RENDERER_URL ?? "http://127.0.0.1:5173";
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../index.html")).catch((error) => {
      console.error("Unable to load packaged renderer page.", error);
    });
  } else {
    mainWindow.loadURL(rendererDevUrl).catch((error) => {
      console.error("Unable to load renderer dev server.", error);
    });
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (stateStore) {
      mainWindow.webContents.send(IPC_CHANNELS.stateChanged, stateStore.getState());
    }
  });

  return mainWindow;
}

function registerStateHandlers(
  store: PersistedStateStore,
  gitLifecycleService: SpaceGitLifecycleService
): void {
  ipcMain.handle(IPC_CHANNELS.getState, async () => store.getState());
  ipcMain.handle(IPC_CHANNELS.saveState, async (_event, nextState: unknown) => store.save(nextState));
  ipcMain.handle(
    IPC_CHANNELS.initializeSpaceGit,
    async (_event, request: SpaceGitLifecycleRequest) =>
      gitLifecycleService.initializeSpace(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.switchSpaceGit,
    async (_event, request: SpaceGitLifecycleRequest) =>
      gitLifecycleService.switchSpace(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.getSpaceChanges,
    async (_event, request: SpaceGitChangesRequest) =>
      gitLifecycleService.getChanges(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.getSpaceFileDiff,
    async (_event, request: SpaceGitFileDiffRequest) =>
      gitLifecycleService.getFileDiff(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.stageSpaceFile,
    async (_event, request: SpaceGitFileRequest) =>
      gitLifecycleService.stageFile(request)
  );
  ipcMain.handle(
    IPC_CHANNELS.unstageSpaceFile,
    async (_event, request: SpaceGitFileRequest) =>
      gitLifecycleService.unstageFile(request)
  );
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  stateStore = new PersistedStateStore((nextState) => {
    broadcastState(nextState);
  });
  const gitLifecycleService = new SpaceGitLifecycleService();
  await stateStore.initialize();

  registerStateHandlers(stateStore, gitLifecycleService);
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

bootstrap().catch((error) => {
  console.error("Failed to bootstrap Kata Cloud shell.", error);
  app.quit();
});
