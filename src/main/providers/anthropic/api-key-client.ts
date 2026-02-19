import { createProviderRuntimeError } from "../../provider-runtime/errors.js";
import type { ProviderClientAuth, ProviderRuntimeErrorCode } from "../../provider-runtime/types.js";
import type {
  AnthropicClientExecuteResult,
  AnthropicClientModel,
  AnthropicProviderClient
} from "./adapter.js";

type AnthropicFetch = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface AnthropicApiKeyClientOptions {
  fetchFn?: AnthropicFetch;
  apiBaseUrl?: string;
  apiVersion?: string;
}

const ANTHROPIC_API_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 1024;

export class AnthropicApiKeyClient implements AnthropicProviderClient {
  private readonly fetchFn: AnthropicFetch;
  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;

  constructor(options: AnthropicApiKeyClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? (fetch as AnthropicFetch);
    this.apiBaseUrl = options.apiBaseUrl ?? ANTHROPIC_API_BASE_URL;
    this.apiVersion = options.apiVersion ?? ANTHROPIC_API_VERSION;
  }

  async listModels(auth: ProviderClientAuth): Promise<AnthropicClientModel[]> {
    const apiKey = requireApiKey(auth);
    let response: Awaited<ReturnType<AnthropicFetch>>;
    try {
      response = await this.fetchFn(`${this.apiBaseUrl}/v1/models`, {
        method: "GET",
        headers: this.createHeaders(apiKey)
      });
    } catch (error) {
      throw createTransportRuntimeError("Anthropic model listing request failed.", error);
    }

    const { payload, readError } = await readPayload(response);
    if (!response.ok) {
      throw toHttpRuntimeError(
        "anthropic",
        response.status,
        payload,
        "Anthropic model listing failed.",
        readError
      );
    }

    if (readError) {
      throw createTransportRuntimeError(
        "Anthropic model listing response could not be read.",
        readError
      );
    }

    return parseModelsPayload(payload);
  }

  async execute(request: {
    auth: ProviderClientAuth;
    model: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<AnthropicClientExecuteResult> {
    const apiKey = requireApiKey(request.auth);
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: normalizeMaxTokens(request.maxTokens),
      messages: [
        {
          role: "user",
          content: request.prompt
        }
      ]
    };
    if (typeof request.systemPrompt === "string" && request.systemPrompt.trim().length > 0) {
      body.system = request.systemPrompt;
    }
    if (typeof request.temperature === "number" && Number.isFinite(request.temperature)) {
      body.temperature = request.temperature;
    }

    let response: Awaited<ReturnType<AnthropicFetch>>;
    try {
      response = await this.fetchFn(`${this.apiBaseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          ...this.createHeaders(apiKey),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw createTransportRuntimeError("Anthropic execution request failed.", error);
    }

    const { payload, readError } = await readPayload(response);
    if (!response.ok) {
      throw toHttpRuntimeError(
        "anthropic",
        response.status,
        payload,
        "Anthropic execution failed.",
        readError
      );
    }

    if (readError) {
      throw createTransportRuntimeError(
        "Anthropic execution response could not be read.",
        readError
      );
    }

    return parseExecutePayload(payload, request.model);
  }

  private createHeaders(apiKey: string): Record<string, string> {
    return {
      Accept: "application/json",
      "x-api-key": apiKey,
      "anthropic-version": this.apiVersion
    };
  }
}

function normalizeMaxTokens(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.floor(value));
  }

  return DEFAULT_MAX_TOKENS;
}

function parseModelsPayload(payload: unknown): AnthropicClientModel[] {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    throw createProviderRuntimeError({
      providerId: "anthropic",
      code: "unexpected_error",
      message: "Anthropic model listing response is malformed.",
      remediation: "Retry shortly. If the issue persists, verify provider API compatibility.",
      retryable: false
    });
  }

  const models: AnthropicClientModel[] = [];
  for (const entry of (payload as { data: unknown[] }).data) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (id.length === 0) {
      continue;
    }

    const displayNameCandidate =
      typeof record.display_name === "string"
        ? record.display_name
        : typeof record.displayName === "string"
          ? record.displayName
          : typeof record.name === "string"
            ? record.name
            : undefined;

    if (typeof displayNameCandidate === "string" && displayNameCandidate.trim().length > 0) {
      models.push({ id, displayName: displayNameCandidate });
      continue;
    }

    models.push({ id });
  }

  return models;
}

function parseExecutePayload(
  payload: unknown,
  fallbackModel: string
): AnthropicClientExecuteResult {
  if (typeof payload !== "object" || payload === null) {
    throw createProviderRuntimeError({
      providerId: "anthropic",
      code: "unexpected_error",
      message: "Anthropic execution response is malformed.",
      remediation: "Retry shortly. If the issue persists, verify provider API compatibility.",
      retryable: false
    });
  }

  const record = payload as Record<string, unknown>;
  const model = typeof record.model === "string" && record.model.trim().length > 0
    ? record.model
    : fallbackModel;

  const textBlocks = Array.isArray(record.content)
    ? record.content
        .filter((block) => typeof block === "object" && block !== null)
        .map((block) => block as Record<string, unknown>)
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => (block.text as string).trim())
        .filter((block) => block.length > 0)
    : [];

  if (textBlocks.length === 0) {
    throw createProviderRuntimeError({
      providerId: "anthropic",
      code: "unexpected_error",
      message: "Anthropic execution response did not include text content.",
      remediation: "Retry shortly. If the issue persists, verify provider API compatibility.",
      retryable: false
    });
  }

  return {
    text: textBlocks.join("\n"),
    model
  };
}

function requireApiKey(auth: ProviderClientAuth): string {
  const apiKey = typeof auth.apiKey === "string" ? auth.apiKey.trim() : "";
  if (auth.authMode !== "api_key" || apiKey.length === 0) {
    throw createProviderRuntimeError({
      providerId: "anthropic",
      code: "missing_auth",
      message: "Anthropic API key is required for API key mode.",
      remediation: "Configure an Anthropic API key and retry.",
      retryable: false
    });
  }

  return apiKey;
}

function toHttpRuntimeError(
  providerId: "anthropic",
  status: number,
  payload: unknown,
  fallbackMessage: string,
  cause?: unknown | null
) {
  const detail = extractErrorDetail(payload);
  const message = detail ?? fallbackMessage;
  const mapped = mapStatusToCode(status);

  return createProviderRuntimeError({
    providerId,
    code: mapped.code,
    message,
    remediation: mapped.remediation,
    retryable: mapped.retryable,
    cause: cause ?? undefined
  });
}

function mapStatusToCode(status: number): {
  code: ProviderRuntimeErrorCode;
  remediation: string;
  retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return {
      code: "invalid_auth",
      remediation: "Refresh provider credentials and retry.",
      retryable: false
    };
  }

  if (status === 429) {
    return {
      code: "rate_limited",
      remediation: "Retry after a backoff period or reduce request rate.",
      retryable: true
    };
  }

  // 529 is Anthropic-specific "overloaded" status (non-standard).
  if (status === 529 || status >= 500) {
    return {
      code: "provider_unavailable",
      remediation: "Retry shortly. If failures continue, verify provider availability.",
      retryable: true
    };
  }

  return {
    code: "unexpected_error",
    remediation: "An unexpected error occurred. Report this issue if it persists.",
    retryable: false
  };
}

function extractErrorDetail(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const direct = (payload as Record<string, unknown>).message;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct;
  }

  const error = (payload as Record<string, unknown>).error;
  if (typeof error === "object" && error !== null) {
    const nested = (error as Record<string, unknown>).message;
    if (typeof nested === "string" && nested.trim().length > 0) {
      return nested;
    }
  }

  return null;
}

async function readPayload(response: {
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}): Promise<{ payload: unknown; readError: unknown | null }> {
  try {
    return { payload: await response.json(), readError: null };
  } catch {
    try {
      const raw = await response.text();
      return { payload: raw.trim().length > 0 ? raw : null, readError: null };
    } catch (error) {
      return { payload: null, readError: error };
    }
  }
}

function createTransportRuntimeError(message: string, cause: unknown) {
  return createProviderRuntimeError({
    providerId: "anthropic",
    code: "provider_unavailable",
    message,
    remediation: "Retry shortly. If failures continue, verify provider availability.",
    retryable: true,
    cause
  });
}
