# Provider Runtime Slice 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the already-merged provider-runtime foundation into main/preload/shared IPC contracts so the renderer can call provider operations in later slices.

**Architecture:** Add typed IPC channels and request/response types to `shell-api.ts` (importing pure types from `provider-runtime/types.ts`). Create a `ProviderRuntimeService` wrapper that routes IPC requests through the registry and normalizes errors. Register handlers in `main/index.ts` with an empty registry (adapters added in Slices 3+). Expose bridge methods in `preload/index.ts`.

**Tech Stack:** TypeScript, Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke`), Vitest for tests.

---

## Scope constraints (STRICT — do not touch)

- Forbidden: `src/main.tsx`, `src/shared/state.ts`, `src/shared/state.test.ts`, `src/styles.css`, `docs/**`, `notes/**`
- Allowed: `src/main/provider-runtime/**`, `src/main/index.ts`, `src/preload/index.ts`, `src/shared/shell-api.ts`, tests for those files only

---

## Design notes

### IPC channel naming
Follow `kata-cloud/<domain>:<action>` convention:
- `kata-cloud/provider:resolve-auth`
- `kata-cloud/provider:list-models`
- `kata-cloud/provider:execute`

### Type placement
`src/main/provider-runtime/types.ts` has zero external imports (pure TypeScript types).
The renderer `tsconfig.renderer.json` includes `src/**/*.ts` so it can resolve these types transitively.
Import from `"../main/provider-runtime/types"` in `shell-api.ts` — same pattern as existing `"../context/types"` imports.

### IPC request types (added to shell-api.ts)
The internal types (`ProviderListModelsRequest`, `ProviderExecuteRequest`) don't carry `providerId` — the IPC layer adds it for routing. Define three thin IPC request types in `shell-api.ts`:
- `ProviderStatusRequest` — `{ providerId, auth }` for auth resolution
- `ProviderListModelsRequest` — `{ providerId, auth }` for model listing
- `ProviderExecuteIpcRequest` — `{ providerId, auth, model, prompt, ... }` for execution

### IPC response types
Re-export `ProviderModelDescriptor` and `ProviderExecuteResult` from runtime types.
Define `ProviderStatusResult` in shell-api.ts (strips internal `apiKey`/`tokenSessionId` — renderer should not receive credential values).

### ProviderRuntimeService (new file)
`src/main/provider-runtime/service.ts` wraps the registry with three methods. Each method:
1. Calls `registry.require(providerId)` — throws `provider_unavailable` if no adapter registered
2. Calls the adapter method
3. Catches errors and passes them through `mapProviderRuntimeError` for normalization

IPC handlers in `main/index.ts` call the service. On `ProviderRuntimeError`, they throw a plain `Error` with JSON payload so renderer can parse structured error info.

### Registry initialization
Empty registry in Slice 2. Real adapters added in later slices (Anthropic in Slice 3, OpenAI in Slice 4). This is correct: when IPC calls come in and no adapter is registered, `registry.require()` throws `ProviderRuntimeError { code: "provider_unavailable" }` which propagates back to renderer.

---

## Task 1: Write failing tests for ProviderRuntimeService

**Files:**
- Create: `src/main/provider-runtime/service.node.test.ts`

**Step 1: Write the failing test**

```typescript
// src/main/provider-runtime/service.node.test.ts
import { describe, expect, it } from "vitest";
import { ProviderRuntimeService } from "./service";
import { ProviderRuntimeError } from "./errors";
import { createProviderRuntimeRegistry } from "./registry";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderAuthResolution,
  ProviderRuntimeAdapter
} from "./types";

const MOCK_API_KEY_AUTH: ProviderAuthInput = { preferredMode: "api_key", apiKey: "test-key" };
const MISSING_AUTH: ProviderAuthInput = { preferredMode: "api_key", apiKey: null };

function createMockAdapter(providerId: ModelProviderId): ProviderRuntimeAdapter {
  return {
    providerId,
    capabilities: { supportsApiKey: true, supportsTokenSession: true, supportsModelListing: true },
    resolveAuth: (auth: ProviderAuthInput): ProviderAuthResolution => ({
      requestedMode: auth.preferredMode ?? "api_key",
      resolvedMode: auth.apiKey ? "api_key" : null,
      status: auth.apiKey ? "authenticated" : "error",
      fallbackApplied: false,
      failureCode: auth.apiKey ? null : "missing_auth",
      reason: auth.apiKey ? null : "anthropic API key is required.",
      apiKey: auth.apiKey ?? null,
      tokenSessionId: null
    }),
    listModels: async () => [{ id: "claude-3", displayName: "Claude 3" }],
    execute: async (request) => ({
      providerId,
      model: request.model,
      authMode: "api_key",
      text: "hello"
    })
  };
}

describe("ProviderRuntimeService.resolveAuth", () => {
  it("returns authenticated status when adapter is registered and auth is valid", () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("anthropic")]);
    const service = new ProviderRuntimeService(registry);

    const result = service.resolveAuth({ providerId: "anthropic", auth: MOCK_API_KEY_AUTH });

    expect(result.providerId).toBe("anthropic");
    expect(result.status).toBe("authenticated");
    expect(result.resolvedMode).toBe("api_key");
    expect(result.failureCode).toBeNull();
  });

  it("returns error status when auth is missing", () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("anthropic")]);
    const service = new ProviderRuntimeService(registry);

    const result = service.resolveAuth({ providerId: "anthropic", auth: MISSING_AUTH });

    expect(result.status).toBe("error");
    expect(result.failureCode).toBe("missing_auth");
    expect(result.resolvedMode).toBeNull();
  });

  it("throws ProviderRuntimeError when provider is not registered", () => {
    const registry = createProviderRuntimeRegistry();
    const service = new ProviderRuntimeService(registry);

    expect(() => service.resolveAuth({ providerId: "anthropic", auth: MOCK_API_KEY_AUTH }))
      .toThrow(ProviderRuntimeError);
  });
});

describe("ProviderRuntimeService.listModels", () => {
  it("returns model descriptors from the registered adapter", async () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("openai")]);
    const service = new ProviderRuntimeService(registry);

    const models = await service.listModels({ providerId: "openai", auth: MOCK_API_KEY_AUTH });

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("claude-3");
  });

  it("throws ProviderRuntimeError when provider is not registered", async () => {
    const registry = createProviderRuntimeRegistry();
    const service = new ProviderRuntimeService(registry);

    await expect(service.listModels({ providerId: "openai", auth: MOCK_API_KEY_AUTH }))
      .rejects.toBeInstanceOf(ProviderRuntimeError);
  });
});

describe("ProviderRuntimeService.execute", () => {
  it("returns execute result from the registered adapter", async () => {
    const registry = createProviderRuntimeRegistry([createMockAdapter("anthropic")]);
    const service = new ProviderRuntimeService(registry);

    const result = await service.execute({
      providerId: "anthropic",
      auth: MOCK_API_KEY_AUTH,
      model: "claude-3",
      prompt: "Hello"
    });

    expect(result.providerId).toBe("anthropic");
    expect(result.text).toBe("hello");
    expect(result.authMode).toBe("api_key");
  });

  it("throws ProviderRuntimeError when provider is not registered", async () => {
    const registry = createProviderRuntimeRegistry();
    const service = new ProviderRuntimeService(registry);

    await expect(service.execute({
      providerId: "anthropic",
      auth: MOCK_API_KEY_AUTH,
      model: "claude-3",
      prompt: "Hello"
    })).rejects.toBeInstanceOf(ProviderRuntimeError);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- service 2>&1 | tail -20`
Expected: FAIL with "Cannot find module './service'"

---

## Task 2: Implement ProviderRuntimeService

**Files:**
- Create: `src/main/provider-runtime/service.ts`

**Step 1: Write the implementation**

```typescript
// src/main/provider-runtime/service.ts
import { mapProviderRuntimeError } from "./errors";
import type { ProviderRuntimeRegistry } from "./registry";
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderAuthMode,
  ProviderAuthFailureCode,
  ProviderModelDescriptor,
  ProviderExecuteResult
} from "./types";

export interface ProviderStatusRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export interface ProviderStatusResult {
  providerId: ModelProviderId;
  resolvedMode: ProviderAuthMode | null;
  status: "authenticated" | "error";
  fallbackApplied: boolean;
  failureCode: ProviderAuthFailureCode | null;
  reason: string | null;
}

export interface ProviderListModelsServiceRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export interface ProviderExecuteServiceRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ProviderRuntimeService {
  constructor(private readonly registry: ProviderRuntimeRegistry) {}

  resolveAuth(request: ProviderStatusRequest): ProviderStatusResult {
    const adapter = this.registry.require(request.providerId);
    const resolution = adapter.resolveAuth(request.auth);
    return {
      providerId: request.providerId,
      resolvedMode: resolution.resolvedMode,
      status: resolution.status,
      fallbackApplied: resolution.fallbackApplied,
      failureCode: resolution.failureCode,
      reason: resolution.reason
    };
  }

  async listModels(request: ProviderListModelsServiceRequest): Promise<ProviderModelDescriptor[]> {
    try {
      const adapter = this.registry.require(request.providerId);
      return await adapter.listModels({ auth: request.auth });
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }

  async execute(request: ProviderExecuteServiceRequest): Promise<ProviderExecuteResult> {
    try {
      const adapter = this.registry.require(request.providerId);
      return await adapter.execute({
        auth: request.auth,
        model: request.model,
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        maxTokens: request.maxTokens,
        temperature: request.temperature
      });
    } catch (error) {
      throw mapProviderRuntimeError(request.providerId, error);
    }
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test -- service 2>&1 | tail -20`
Expected: All service tests PASS

**Step 3: Commit**

```bash
git add src/main/provider-runtime/service.ts src/main/provider-runtime/service.node.test.ts
git commit -m "feat: add ProviderRuntimeService with auth/list/execute routing"
```

---

## Task 3: Update provider-runtime index to export service

**Files:**
- Modify: `src/main/provider-runtime/index.ts`

**Step 1: Add service export**

Current content:
```typescript
export * from "./auth";
export * from "./errors";
export * from "./registry";
export * from "./types";
```

Add:
```typescript
export * from "./service";
```

**Step 2: Run typecheck to verify clean**

Run: `pnpm run desktop:typecheck 2>&1 | tail -10`
Expected: exit 0

---

## Task 4: Add IPC channels and types to shell-api.ts

**Files:**
- Modify: `src/shared/shell-api.ts`

**Step 1: Add the new imports and types**

After the existing context import line, add:
```typescript
import type {
  ModelProviderId,
  ProviderAuthInput,
  ProviderModelDescriptor,
  ProviderExecuteResult
} from "../main/provider-runtime/types";
import type { ProviderStatusResult } from "../main/provider-runtime/service";
```

Add three new channel keys to `IPC_CHANNELS`:
```typescript
providerResolveAuth: "kata-cloud/provider:resolve-auth",
providerListModels: "kata-cloud/provider:list-models",
providerExecute: "kata-cloud/provider:execute",
```

Add IPC request types (after the existing exports or inline in the file):
```typescript
export interface ProviderStatusRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export interface ProviderListModelsRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
}

export interface ProviderExecuteIpcRequest {
  providerId: ModelProviderId;
  auth: ProviderAuthInput;
  model: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}
```

Add re-exports so renderer can use response types:
```typescript
export type { ProviderStatusResult, ProviderModelDescriptor, ProviderExecuteResult };
```

Add three methods to `ShellApi` interface:
```typescript
providerResolveAuth: (request: ProviderStatusRequest) => Promise<ProviderStatusResult>;
providerListModels: (request: ProviderListModelsRequest) => Promise<ProviderModelDescriptor[]>;
providerExecute: (request: ProviderExecuteIpcRequest) => Promise<ProviderExecuteResult>;
```

**Step 2: Run typecheck to confirm clean**

Run: `pnpm run desktop:typecheck 2>&1 | tail -10`
Expected: exit 0

---

## Task 5: Register IPC handlers in main/index.ts

**Files:**
- Modify: `src/main/index.ts`

**Step 1: Add import for provider-runtime**

After existing imports, add:
```typescript
import { createProviderRuntimeRegistry } from "../main/provider-runtime/registry";
import { ProviderRuntimeService } from "../main/provider-runtime/service";
import { ProviderRuntimeError } from "../main/provider-runtime/errors";
import type { ModelProviderId, ProviderAuthInput } from "../main/provider-runtime/types";
```

Wait — `main/index.ts` is already IN `src/main/`, so the relative paths would be:
```typescript
import { createProviderRuntimeRegistry } from "./provider-runtime/registry";
import { ProviderRuntimeService } from "./provider-runtime/service";
import { ProviderRuntimeError } from "./provider-runtime/errors";
import type { ModelProviderId, ProviderAuthInput } from "./provider-runtime/types";
```

**Step 2: Add helper to serialize ProviderRuntimeError for IPC**

Add before `registerStateHandlers`:
```typescript
function serializeProviderError(error: unknown): never {
  if (error instanceof ProviderRuntimeError) {
    throw new Error(
      JSON.stringify({
        code: error.code,
        message: error.message,
        remediation: error.remediation,
        retryable: error.retryable,
        providerId: error.providerId
      })
    );
  }
  throw error;
}
```

**Step 3: Update registerStateHandlers signature and body**

Change signature to also accept the provider service:
```typescript
function registerStateHandlers(
  store: PersistedStateStore,
  gitLifecycleService: SpaceGitLifecycleService,
  pullRequestWorkflowService: PullRequestWorkflowService,
  providerService: ProviderRuntimeService
): void {
```

Add three handlers at the end of `registerStateHandlers` (after the `retrieveContext` handler):
```typescript
  ipcMain.handle(
    IPC_CHANNELS.providerResolveAuth,
    (_event, request: { providerId: ModelProviderId; auth: ProviderAuthInput }) => {
      try {
        return providerService.resolveAuth(request);
      } catch (error) {
        serializeProviderError(error);
      }
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.providerListModels,
    async (_event, request: { providerId: ModelProviderId; auth: ProviderAuthInput }) => {
      try {
        return await providerService.listModels(request);
      } catch (error) {
        serializeProviderError(error);
      }
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.providerExecute,
    async (
      _event,
      request: {
        providerId: ModelProviderId;
        auth: ProviderAuthInput;
        model: string;
        prompt: string;
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
      }
    ) => {
      try {
        return await providerService.execute(request);
      } catch (error) {
        serializeProviderError(error);
      }
    }
  );
```

**Step 4: Update bootstrap to create registry and service**

In `bootstrap()`, after creating `pullRequestWorkflowService`:
```typescript
const providerRegistry = createProviderRuntimeRegistry(); // empty in Slice 2; adapters added in Slice 3+
const providerService = new ProviderRuntimeService(providerRegistry);
```

Update `registerStateHandlers` call to pass `providerService`:
```typescript
registerStateHandlers(stateStore, gitLifecycleService, pullRequestWorkflowService, providerService);
```

**Step 5: Run typecheck**

Run: `pnpm run desktop:typecheck 2>&1 | tail -10`
Expected: exit 0

---

## Task 6: Add preload bridge methods in preload/index.ts

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Add imports for provider IPC types**

After existing imports, add:
```typescript
import type { ProviderStatusRequest, ProviderListModelsRequest, ProviderExecuteIpcRequest } from "../shared/shell-api";
```

Note: `ProviderStatusResult`, `ProviderModelDescriptor`, `ProviderExecuteResult` are return types, no need to import explicitly (TypeScript infers from IPC_CHANNELS mapping).

**Step 2: Add three bridge methods to shellApi**

After `retrieveContext`:
```typescript
  providerResolveAuth: async (request: ProviderStatusRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.providerResolveAuth, request),
  providerListModels: async (request: ProviderListModelsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.providerListModels, request),
  providerExecute: async (request: ProviderExecuteIpcRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.providerExecute, request),
```

**Step 3: Run typecheck**

Run: `pnpm run desktop:typecheck 2>&1 | tail -10`
Expected: exit 0

---

## Task 7: Full validation pass

**Step 1: Run provider tests**

Run: `pnpm test -- providers 2>&1 | tail -20`
Expected: All provider tests PASS (includes new service tests + existing registry/auth/errors tests)

**Step 2: Run context tests**

Run: `pnpm test -- context 2>&1 | tail -20`
Expected: All context tests PASS (no regression)

**Step 3: Run full typecheck**

Run: `pnpm run desktop:typecheck 2>&1`
Expected: exit 0 (both main and renderer configs pass)

**Step 4: Verify allowed-files-only scope**

Run: `git diff --name-only origin/main...HEAD`
Expected output must contain ONLY:
```
src/main/provider-runtime/service.ts
src/main/provider-runtime/service.node.test.ts
src/main/provider-runtime/index.ts
src/shared/shell-api.ts
src/main/index.ts
src/preload/index.ts
docs/plans/2026-02-17-provider-runtime-slice2.md
```

**Step 5: Final commit (if not already committed per task)**

```bash
git add src/shared/shell-api.ts src/preload/index.ts src/main/index.ts src/main/provider-runtime/index.ts
git commit -m "feat: wire provider runtime IPC channels, handlers, and preload bridge"
```

---

## PR Description Template

```markdown
## Summary

- Add typed IPC channels `kata-cloud/provider:resolve-auth`, `kata-cloud/provider:list-models`, `kata-cloud/provider:execute` to `shell-api.ts`
- Add `ProviderRuntimeService` wrapper class that routes IPC requests through the registry and normalizes errors via `mapProviderRuntimeError`
- Register three IPC handlers in `main/index.ts` with an empty registry (adapters added in Slice 3+)
- Expose `providerResolveAuth`, `providerListModels`, `providerExecute` bridge methods in `preload/index.ts`
- All provider failures propagate as JSON-encoded `ProviderRuntimeError` payloads so renderer can parse structured error info

## Files changed

- `src/main/provider-runtime/service.ts` (new)
- `src/main/provider-runtime/service.node.test.ts` (new)
- `src/main/provider-runtime/index.ts` (re-export service)
- `src/shared/shell-api.ts` (channels + types + ShellApi methods)
- `src/main/index.ts` (handlers + registry init)
- `src/preload/index.ts` (bridge methods)

## Validation

- `pnpm test -- providers`: [paste output]
- `pnpm test -- context`: [paste output]
- `pnpm run desktop:typecheck`: [paste output]

## Residual risks

- Registry is empty in Slice 2: all provider calls return `provider_unavailable` until Slice 3 (Anthropic adapter) and Slice 4 (OpenAI adapter) land
- IPC error serialization uses JSON string in `Error.message`; renderer must parse this in Slice 6 (renderer UX)
- No manual smoke gap beyond typecheck since app can't complete real provider calls without adapters
```
