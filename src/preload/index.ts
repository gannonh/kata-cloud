import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { AppState } from "../shared/state";
import { IPC_CHANNELS, ShellApi } from "../shared/shell-api";
import type { SpaceGitLifecycleRequest } from "../git/types";

const shellApi: ShellApi = {
  getState: async () => ipcRenderer.invoke(IPC_CHANNELS.getState) as Promise<AppState>,
  saveState: async (nextState) => ipcRenderer.invoke(IPC_CHANNELS.saveState, nextState) as Promise<AppState>,
  subscribeState: (listener) => {
    const handler = (_event: IpcRendererEvent, nextState: AppState) => {
      listener(nextState);
    };

    ipcRenderer.on(IPC_CHANNELS.stateChanged, handler);

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.stateChanged, handler);
    };
  },
  initializeSpaceGit: async (request: SpaceGitLifecycleRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.initializeSpaceGit, request),
  switchSpaceGit: async (request: SpaceGitLifecycleRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.switchSpaceGit, request)
};

contextBridge.exposeInMainWorld("kataShell", shellApi);
