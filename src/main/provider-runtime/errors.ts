import type {
  ModelProviderId,
  ProviderAuthResolution,
  ProviderRuntimeErrorCode
} from "./types";

interface ProviderRuntimeErrorInput {
  providerId: ModelProviderId;
  code: ProviderRuntimeErrorCode;
  message: string;
  remediation: string;
  retryable: boolean;
  cause?: unknown;
}

export class ProviderRuntimeError extends Error {
  readonly providerId: ModelProviderId;
  readonly code: ProviderRuntimeErrorCode;
  readonly remediation: string;
  readonly retryable: boolean;

  constructor(input: ProviderRuntimeErrorInput) {
    super(input.message);
    this.name = "ProviderRuntimeError";
    this.providerId = input.providerId;
    this.code = input.code;
    this.remediation = input.remediation;
    this.retryable = input.retryable;
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }
}

export function createProviderRuntimeError(input: ProviderRuntimeErrorInput): ProviderRuntimeError {
  return new ProviderRuntimeError(input);
}

export function createAuthResolutionError(
  providerId: ModelProviderId,
  resolution: ProviderAuthResolution
): ProviderRuntimeError {
  const code = resolution.failureCode ?? "missing_auth";

  return createProviderRuntimeError({
    providerId,
    code,
    message:
      resolution.reason ??
      `${providerId} authentication failed with "${code}" while resolving ${resolution.requestedMode} mode.`,
    remediation: getRemediationForCode(code),
    retryable: code === "session_expired"
  });
}

export function mapProviderRuntimeError(
  providerId: ModelProviderId,
  error: unknown
): ProviderRuntimeError {
  if (error instanceof ProviderRuntimeError) {
    return error;
  }

  const message = getErrorMessage(error) ?? `${providerId} provider request failed.`;
  const normalized = message.toLowerCase();
  const code = inferCode(normalized);

  return createProviderRuntimeError({
    providerId,
    code,
    message,
    remediation: getRemediationForCode(code),
    retryable: code === "rate_limited" || code === "provider_unavailable" || code === "session_expired",
    cause: error
  });
}

function inferCode(normalizedMessage: string): ProviderRuntimeErrorCode {
  if (
    normalizedMessage.includes("session expired") ||
    normalizedMessage.includes("token expired")
  ) {
    return "session_expired";
  }

  if (
    normalizedMessage.includes("invalid api key") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("401")
  ) {
    return "invalid_auth";
  }

  if (
    normalizedMessage.includes("missing api key") ||
    normalizedMessage.includes("no api key") ||
    normalizedMessage.includes("auth missing")
  ) {
    return "missing_auth";
  }

  if (normalizedMessage.includes("rate limit") || normalizedMessage.includes("429")) {
    return "rate_limited";
  }

  return "provider_unavailable";
}

function getRemediationForCode(code: ProviderRuntimeErrorCode): string {
  switch (code) {
    case "missing_auth":
      return "Configure an API key or sign in with a provider token session, then retry.";
    case "invalid_auth":
      return "Refresh provider credentials and retry.";
    case "session_expired":
      return "Re-authenticate the token session or switch to API key mode.";
    case "rate_limited":
      return "Retry after a backoff period or reduce request rate.";
    case "provider_unavailable":
      return "Retry shortly. If failures continue, verify provider availability.";
  }
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const candidate = (error as { message?: unknown }).message;
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return null;
}
