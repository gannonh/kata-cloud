import type { ShellApi } from "./shared/shell-api";

declare global {
  interface Window {
    kataShell?: ShellApi;
  }
}

export {};
