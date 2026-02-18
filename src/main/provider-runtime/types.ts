export type ModelProviderId = "anthropic" | "openai";

export type ProviderAuthMode = "api_key" | "token_session";

export type ProviderAuthFailureCode = "missing_auth" | "invalid_auth" | "session_expired";

export type ProviderRuntimeErrorCode =
  | ProviderAuthFailureCode
  | "rate_limited"
  | "provider_unavailable"
  | "unexpected_error";

export interface ProviderTokenSession {
  id: string;
  status: "active" | "expired";
  issuedAt?: string;
  expiresAt?: string;
}

export interface ProviderAuthInput {
  preferredMode?: ProviderAuthMode;
  apiKey?: string | null;
  tokenSession?: ProviderTokenSession | null;
}

export interface ProviderAuthResolution {
  requestedMode: ProviderAuthMode;
  resolvedMode: ProviderAuthMode | null;
  status: "authenticated" | "error";
  fallbackApplied: boolean;
  failureCode: ProviderAuthFailureCode | null;
  reason: string | null;
  apiKey: string | null;
  tokenSessionId: string | null;
}

export interface ProviderCapabilities {
  supportsApiKey: boolean;
  supportsTokenSession: boolean;
  supportsModelListing: boolean;
}

export interface ProviderModelDescriptor {
  id: string;
  displayName: string;
}

export interface ProviderListModelsRequest {
  auth: ProviderAuthInput;
}

export interface ProviderExecuteRequest {
  auth: ProviderAuthInput;
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderExecuteResult {
  providerId: ModelProviderId;
  model: string;
  authMode: ProviderAuthMode;
  text: string;
}

export interface ProviderClientAuth {
  authMode: ProviderAuthMode;
  apiKey?: string;
  tokenSessionId?: string;
}

export interface ProviderRuntimeAdapter {
  readonly providerId: ModelProviderId;
  readonly capabilities: ProviderCapabilities;
  resolveAuth(auth: ProviderAuthInput): ProviderAuthResolution;
  listModels(request: ProviderListModelsRequest): Promise<ProviderModelDescriptor[]>;
  execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult>;
}

// IPC request/response types — shared between the main-process service and the preload bridge.

export interface ProviderStatusRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export type ProviderStatusResult =
  | {
      providerId: ModelProviderId;
      status: "authenticated";
      requestedMode: ProviderAuthMode;
      resolvedMode: ProviderAuthMode;
      fallbackApplied: boolean;
    }
  | {
      providerId: ModelProviderId;
      status: "error";
      requestedMode: ProviderAuthMode;
      resolvedMode: null;
      fallbackApplied: boolean;
      failureCode: ProviderAuthFailureCode;
      reason: string | null;
    };

export interface ProviderListModelsIpcRequest extends ProviderListModelsRequest {
  providerId: ModelProviderId;
}

export interface ProviderExecuteIpcRequest extends ProviderExecuteRequest {
  providerId: ModelProviderId;
}
