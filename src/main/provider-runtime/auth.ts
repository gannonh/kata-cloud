import type {
  ModelProviderId,
  ProviderAuthFailureCode,
  ProviderAuthInput,
  ProviderAuthMode,
  ProviderAuthResolution,
  ProviderClientAuth
} from "./types";

interface ResolveProviderAuthInput {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
  supportsTokenSession: boolean;
  defaultMode?: ProviderAuthMode;
}

export function resolveProviderAuth(input: ResolveProviderAuthInput): ProviderAuthResolution {
  const apiKey = normalizeString(input.auth.apiKey);
  const tokenSession = input.auth.tokenSession ?? null;
  const tokenSessionId = normalizeString(tokenSession?.id);
  const tokenSessionActive = tokenSession?.status === "active";
  const tokenSessionExpired = tokenSession?.status === "expired";
  const requestedMode =
    input.auth.preferredMode ??
    input.defaultMode ??
    (input.supportsTokenSession ? "token_session" : "api_key");

  if (requestedMode === "api_key") {
    if (apiKey) {
      return createAuthenticatedResolution(requestedMode, requestedMode, false, apiKey, null);
    }

    return createFailureResolution(
      requestedMode,
      "missing_auth",
      `${input.providerId} API key is required for API key mode.`,
      apiKey,
      tokenSessionId
    );
  }

  if (!input.supportsTokenSession) {
    if (apiKey) {
      return createAuthenticatedResolution(requestedMode, "api_key", true, apiKey, null);
    }

    return createFailureResolution(
      requestedMode,
      "missing_auth",
      `${input.providerId} token session mode is unavailable and no API key is configured.`,
      apiKey,
      tokenSessionId
    );
  }

  if (tokenSessionActive) {
    if (!tokenSessionId) {
      if (apiKey) {
        return createAuthenticatedResolution(requestedMode, "api_key", true, apiKey, null);
      }

      return createFailureResolution(
        requestedMode,
        "invalid_auth",
        `${input.providerId} token session is active but missing a session id.`,
        apiKey,
        tokenSessionId
      );
    }

    return createAuthenticatedResolution(requestedMode, requestedMode, false, null, tokenSessionId);
  }

  if (apiKey) {
    return createAuthenticatedResolution(requestedMode, "api_key", true, apiKey, null);
  }

  if (tokenSessionExpired) {
    return createFailureResolution(
      requestedMode,
      "session_expired",
      `${input.providerId} token session expired and no API key fallback is configured.`,
      apiKey,
      tokenSessionId
    );
  }

  return createFailureResolution(
    requestedMode,
    "missing_auth",
    `${input.providerId} token session is unavailable and no API key fallback is configured.`,
    apiKey,
    tokenSessionId
  );
}

function createAuthenticatedResolution(
  requestedMode: ProviderAuthMode,
  resolvedMode: ProviderAuthMode,
  fallbackApplied: boolean,
  apiKey: string | null,
  tokenSessionId: string | null
): ProviderAuthResolution {
  return {
    requestedMode,
    resolvedMode,
    status: "authenticated",
    fallbackApplied,
    failureCode: null,
    reason: fallbackApplied
      ? `Requested ${requestedMode} mode was unavailable; falling back to ${resolvedMode}.`
      : null,
    apiKey: resolvedMode === "api_key" ? apiKey : null,
    tokenSessionId: resolvedMode === "token_session" ? tokenSessionId : null
  };
}

function createFailureResolution(
  requestedMode: ProviderAuthMode,
  failureCode: ProviderAuthFailureCode,
  reason: string,
  apiKey: string | null,
  tokenSessionId: string | null
): ProviderAuthResolution {
  return {
    requestedMode,
    resolvedMode: null,
    status: "error",
    fallbackApplied: false,
    failureCode,
    reason,
    apiKey,
    tokenSessionId
  };
}

export function toClientAuth(resolution: ProviderAuthResolution): ProviderClientAuth {
  if (!resolution.resolvedMode) {
    throw new Error("Expected resolved auth mode for provider client request.");
  }

  return {
    authMode: resolution.resolvedMode,
    apiKey: resolution.apiKey ?? undefined,
    tokenSessionId: resolution.tokenSessionId ?? undefined
  };
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
