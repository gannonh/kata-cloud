import { createProviderRuntimeError } from "../../provider-runtime/errors.js";
import type { ProviderClientAuth, ProviderRuntimeErrorCode } from "../../provider-runtime/types.js";
import type {
  OpenAiClientExecuteResult,
  OpenAiClientModel,
  OpenAiProviderClient
} from "./adapter.js";

type OpenAiFetch = (
  input: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export interface OpenAiApiKeyClientOptions {
  fetchFn?: OpenAiFetch;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

const OPENAI_API_BASE_URL = "https://api.openai.com";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

export class OpenAiApiKeyClient implements OpenAiProviderClient {
  private readonly fetchFn: OpenAiFetch;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: OpenAiApiKeyClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? (fetch as OpenAiFetch);
    this.apiBaseUrl = options.apiBaseUrl ?? OPENAI_API_BASE_URL;
    this.timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  }

  async listModels(auth: ProviderClientAuth): Promise<OpenAiClientModel[]> {
    const apiKey = requireApiKey(auth);
    let response: Awaited<ReturnType<OpenAiFetch>>;
    try {
      response = await this.fetchWithTimeout(`${this.apiBaseUrl}/v1/models`, {
        method: "GET",
        headers: this.createHeaders(apiKey)
      });
    } catch (error) {
      throw createTransportRuntimeError("OpenAI model listing request failed.", error);
    }

    const { payload, readError } = await readPayload(response);
    if (!response.ok) {
      throw toHttpRuntimeError(
        "openai",
        response.status,
        payload,
        "OpenAI model listing failed.",
        readError
      );
    }

    if (readError) {
      throw createTransportRuntimeError("OpenAI model listing response could not be read.", readError);
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
  }): Promise<OpenAiClientExecuteResult> {
    const apiKey = requireApiKey(request.auth);
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (typeof request.systemPrompt === "string" && request.systemPrompt.trim().length > 0) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_completion_tokens: normalizeMaxTokens(request.maxTokens)
    };
    if (typeof request.temperature === "number" && Number.isFinite(request.temperature)) {
      body.temperature = clampTemperature(request.temperature);
    }

    let response: Awaited<ReturnType<OpenAiFetch>>;
    try {
      response = await this.fetchWithTimeout(`${this.apiBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          ...this.createHeaders(apiKey),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw createTransportRuntimeError("OpenAI execution request failed.", error);
    }

    const { payload, readError } = await readPayload(response);
    if (!response.ok) {
      throw toHttpRuntimeError("openai", response.status, payload, "OpenAI execution failed.", readError);
    }

    if (readError) {
      throw createTransportRuntimeError("OpenAI execution response could not be read.", readError);
    }

    return parseExecutePayload(payload, request.model);
  }

  private createHeaders(apiKey: string): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`
    };
  }

  private async fetchWithTimeout(
    input: string,
    init: RequestInit
  ): Promise<Awaited<ReturnType<OpenAiFetch>>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(input, {
        ...init,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeMaxTokens(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.floor(value));
  }

  return DEFAULT_MAX_TOKENS;
}

function normalizeTimeoutMs(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.floor(value));
  }
  return DEFAULT_TIMEOUT_MS;
}

function clampTemperature(value: number): number {
  return Math.max(0, Math.min(2, value));
}

function parseModelsPayload(payload: unknown): OpenAiClientModel[] {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    throw createProviderRuntimeError({
      providerId: "openai",
      code: "unexpected_error",
      message: "OpenAI model listing response is malformed.",
      remediation: "Retry shortly. If the issue persists, verify provider API compatibility.",
      retryable: false
    });
  }

  const models: OpenAiClientModel[] = [];
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

function parseExecutePayload(payload: unknown, fallbackModel: string): OpenAiClientExecuteResult {
  if (typeof payload !== "object" || payload === null) {
    throw createProviderRuntimeError({
      providerId: "openai",
      code: "unexpected_error",
      message: "OpenAI execution response is malformed.",
      remediation: "Retry shortly. If the issue persists, verify provider API compatibility.",
      retryable: false
    });
  }

  const record = payload as Record<string, unknown>;
  const model =
    typeof record.model === "string" && record.model.trim().length > 0
      ? record.model
      : fallbackModel;
  const choiceBlocks = Array.isArray(record.choices)
    ? record.choices.filter((choice) => typeof choice === "object" && choice !== null)
    : [];
  const textBlocks = choiceBlocks
    .map((choice) => extractChoiceText(choice as Record<string, unknown>))
    .filter((block): block is string => typeof block === "string" && block.length > 0);

  if (textBlocks.length === 0) {
    throw createProviderRuntimeError({
      providerId: "openai",
      code: "unexpected_error",
      message: "OpenAI execution response did not include text content.",
      remediation: "Retry shortly. If the issue persists, verify provider API compatibility.",
      retryable: false
    });
  }

  return {
    model,
    text: textBlocks.join("\n")
  };
}

function extractChoiceText(choice: Record<string, unknown>): string | null {
  const direct = choice.message;
  if (typeof direct === "object" && direct !== null) {
    const message = direct as Record<string, unknown>;
    const content = message.content;

    if (typeof content === "string") {
      const trimmed = content.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(content)) {
      const chunks = content
        .filter((entry) => typeof entry === "object" && entry !== null)
        .map((entry) => entry as Record<string, unknown>)
        .filter((entry) => entry.type === "text" && typeof entry.text === "string")
        .map((entry) => (entry.text as string).trim())
        .filter((entry) => entry.length > 0);
      if (chunks.length > 0) {
        return chunks.join("\n");
      }
    }
  }

  const fallback = choice.text;
  if (typeof fallback === "string") {
    const trimmed = fallback.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function requireApiKey(auth: ProviderClientAuth): string {
  const apiKey = typeof auth.apiKey === "string" ? auth.apiKey.trim() : "";
  if (auth.authMode !== "api_key" || apiKey.length === 0) {
    throw createProviderRuntimeError({
      providerId: "openai",
      code: "missing_auth",
      message: "OpenAI API key is required for API key mode.",
      remediation: "Configure an OpenAI API key and retry.",
      retryable: false
    });
  }

  return apiKey;
}

function toHttpRuntimeError(
  providerId: "openai",
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

  if (status >= 500) {
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
  text: () => Promise<string>;
}): Promise<{ payload: unknown; readError: unknown | null }> {
  try {
    const raw = await response.text();
    try {
      return { payload: JSON.parse(raw), readError: null };
    } catch {
      return { payload: raw.trim().length > 0 ? raw : null, readError: null };
    }
  } catch (error) {
    return { payload: null, readError: error };
  }
}

function createTransportRuntimeError(message: string, cause: unknown) {
  return createProviderRuntimeError({
    providerId: "openai",
    code: "provider_unavailable",
    message,
    remediation: "Retry shortly. If failures continue, verify provider availability.",
    retryable: true,
    cause
  });
}
