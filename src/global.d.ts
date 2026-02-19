import type { ShellApi } from "./shared/shell-api.js";

declare global {
  interface Window {
    kataShell?: ShellApi;
  }
}

export {};
