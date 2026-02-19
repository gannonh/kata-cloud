import type { CreateSpaceInput, SpaceMetadata } from "./types.js";
import {
  type SpaceValidationErrors,
  parseTags,
  validateCreateSpaceInput
} from "./validation.js";

export const SPACES_STORAGE_KEY = "kata-cloud.spaces.v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type CreateSpaceResult =
  | {
      ok: true;
      space: SpaceMetadata;
      spaces: SpaceMetadata[];
    }
  | {
      ok: false;
      errors: SpaceValidationErrors;
    };

export class SpaceStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly storageKey = SPACES_STORAGE_KEY
  ) {}

  loadSpaces(): SpaceMetadata[] {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is SpaceMetadata => Boolean(item && item.id))
        .map((item) => ({
          ...item,
          name: String(item.name ?? "").trim(),
          path: String(item.path ?? "").trim(),
          prompt: String(item.prompt ?? "").trim(),
          description: item.description ? String(item.description).trim() : "",
          repo: item.repo ? String(item.repo).trim() : undefined,
          tags: Array.isArray(item.tags)
            ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
            : []
        }));
    } catch {
      return [];
    }
  }

  createSpace(input: CreateSpaceInput): CreateSpaceResult {
    const existingSpaces = this.loadSpaces();
    const sanitizedInput: CreateSpaceInput = {
      ...input,
      name: input.name.trim(),
      path: input.path.trim(),
      prompt: input.prompt.trim(),
      repo: input.repo?.trim(),
      description: input.description?.trim(),
      tags: normalizeTags(input.tags ?? [])
    };
    const errors = validateCreateSpaceInput(sanitizedInput, existingSpaces);
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const now = new Date().toISOString();
    const newSpace: SpaceMetadata = {
      id: createSpaceId(),
      prompt: sanitizedInput.prompt,
      name: sanitizedInput.name,
      path: sanitizedInput.path,
      repo: sanitizeOptional(sanitizedInput.repo),
      description: sanitizeOptional(sanitizedInput.description),
      tags: sanitizeTags(sanitizedInput.tags ?? []),
      createdAt: now,
      updatedAt: now
    };

    const nextSpaces = [...existingSpaces, newSpace];
    this.saveSpaces(nextSpaces);
    return {
      ok: true,
      space: newSpace,
      spaces: nextSpaces
    };
  }

  private saveSpaces(spaces: SpaceMetadata[]): void {
    this.storage.setItem(this.storageKey, JSON.stringify(spaces));
  }
}

function sanitizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTags(tags: string[]): string[] {
  return tags.flatMap((tag) => parseTags(tag));
}

function sanitizeTags(tags: string[]): string[] {
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => tag.toLowerCase());
}

function createSpaceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `space_${Math.random().toString(16).slice(2, 10)}`;
}
