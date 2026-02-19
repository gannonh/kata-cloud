/**
 * Shared IPC error contract between the main process and the renderer.
 *
 * The main process serializes ProviderRuntimeError instances as plain Errors
 * with a JSON-encoded message so that Electron's IPC boundary preserves the
 * structured fields. Renderer code should call parseProviderIpcError to
 * deserialize the payload rather than reading error.message directly.
 */

export interface ProviderIpcErrorPayload {
  code: string;
  message: string;
  remediation: string;
  retryable: boolean;
  providerId: string;
  runtimeMode?: "native" | "pi";
}

export function parseProviderIpcError(error: unknown): ProviderIpcErrorPayload | null {
  if (!(error instanceof Error)) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(error.message);
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).code === "string" &&
      typeof (payload as Record<string, unknown>).message === "string" &&
      typeof (payload as Record<string, unknown>).remediation === "string" &&
      typeof (payload as Record<string, unknown>).retryable === "boolean" &&
      typeof (payload as Record<string, unknown>).providerId === "string"
    ) {
      const runtimeMode = (payload as Record<string, unknown>).runtimeMode;
      if (
        runtimeMode !== undefined &&
        runtimeMode !== "native" &&
        runtimeMode !== "pi"
      ) {
        return null;
      }
      return payload as ProviderIpcErrorPayload;
    }
    return null;
  } catch {
    return null;
  }
}
