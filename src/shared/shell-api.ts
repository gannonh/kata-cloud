import type { AppState } from "./state";
import type {
  SpaceGitLifecycleRequest,
  SpaceGitLifecycleStatus
} from "../git/types";

export const IPC_CHANNELS = {
  getState: "kata-cloud/state:get",
  saveState: "kata-cloud/state:save",
  stateChanged: "kata-cloud/state:changed",
  initializeSpaceGit: "kata-cloud/space-git:initialize",
  switchSpaceGit: "kata-cloud/space-git:switch"
} as const;

export interface ShellApi {
  getState: () => Promise<AppState>;
  saveState: (nextState: AppState) => Promise<AppState>;
  subscribeState: (listener: (nextState: AppState) => void) => () => void;
  initializeSpaceGit: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
  switchSpaceGit: (
    request: SpaceGitLifecycleRequest
  ) => Promise<SpaceGitLifecycleStatus>;
}
