import type {
  ContextProviderId,
  ContextRetrievalErrorCode,
  ContextRetrievalFailure
} from "../context/types.js";

export interface ContextIpcErrorPayload {
  code: ContextRetrievalErrorCode;
  message: string;
  remediation: string;
  retryable: boolean;
  providerId: ContextProviderId;
}

export function createContextIpcErrorPayload(
  payload: ContextIpcErrorPayload
): ContextIpcErrorPayload {
  return payload;
}

export function parseContextIpcError(error: unknown): ContextIpcErrorPayload | null {
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
      return payload as ContextIpcErrorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeContextIpcError(payload: ContextIpcErrorPayload): Error {
  return new Error(JSON.stringify(payload));
}

export function toContextRetrievalFailure(
  payload: ContextIpcErrorPayload
): ContextRetrievalFailure {
  return {
    ok: false,
    providerId: payload.providerId,
    snippets: [],
    error: payload
  };
}

