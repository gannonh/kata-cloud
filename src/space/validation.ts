import type { CreateSpaceInput, SpaceMetadata } from "./types.js";

export type SpaceValidationErrors = Partial<
  Record<"name" | "path" | "repo", string>
>;

const SPACE_NAME_PATTERN = /^[A-Za-z0-9]+(?:[A-Za-z0-9 _-]*[A-Za-z0-9])?$/;
const INVALID_PATH_CHARS = /\0/;

export function normalizeSpaceName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeWorkspaceRoot(rootPath: string): string {
  return rootPath.trim().replace(/[\\/]+$/, "").toLowerCase();
}

export function parseTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function suggestSpaceNameFromPrompt(prompt: string): string {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!cleaned) {
    return "new-space";
  }

  return cleaned.split(/\s+/).slice(0, 4).join("-");
}

export function validateCreateSpaceInput(
  input: CreateSpaceInput,
  existingSpaces: SpaceMetadata[]
): SpaceValidationErrors {
  const errors: SpaceValidationErrors = {};
  const trimmedName = input.name.trim();
  const trimmedPath = input.path.trim();
  const trimmedRepo = input.repo?.trim() ?? "";

  if (trimmedName.length === 0) {
    errors.name = "Space name is required.";
  } else if (!SPACE_NAME_PATTERN.test(trimmedName)) {
    errors.name =
      "Use letters, numbers, spaces, hyphens, or underscores for the space name.";
  } else if (trimmedName === "." || trimmedName === "..") {
    errors.name = "This space name is not allowed.";
  }

  if (trimmedPath.length === 0) {
    errors.path = "Workspace root path is required.";
  } else if (INVALID_PATH_CHARS.test(trimmedPath)) {
    errors.path = "Workspace root path contains invalid characters.";
  }

  if (trimmedRepo.length > 0 && !isValidRepoReference(trimmedRepo)) {
    errors.repo = "Repo link must be a valid URL or SSH git remote.";
  }

  if (!errors.name && !errors.path) {
    const normalizedName = normalizeSpaceName(trimmedName);
    const normalizedRoot = normalizeWorkspaceRoot(trimmedPath);
    const duplicate = existingSpaces.some(
      (space) =>
        normalizeWorkspaceRoot(space.path) === normalizedRoot &&
        normalizeSpaceName(space.name) === normalizedName
    );

    if (duplicate) {
      errors.name = "A space with this name already exists in this workspace root.";
    }
  }

  return errors;
}

function isValidRepoReference(repo: string): boolean {
  try {
    const parsed = new URL(repo);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return /^[^@\s]+@[^:\s]+:[^\s]+$/.test(repo);
  }
}
