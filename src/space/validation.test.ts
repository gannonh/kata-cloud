import { describe, expect, it } from "vitest";
import type { SpaceMetadata } from "./types";
import { validateCreateSpaceInput } from "./validation";

const existingSpaces: SpaceMetadata[] = [
  {
    id: "space_a",
    prompt: "Prompt A",
    name: "kata-mvp",
    path: "/workspace/project-a",
    tags: ["mvp"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

describe("validateCreateSpaceInput", () => {
  it("rejects names with unsupported characters", () => {
    const errors = validateCreateSpaceInput(
      {
        prompt: "Build Kata Cloud",
        name: "bad/name",
        path: "/workspace/project-a"
      },
      []
    );

    expect(errors.name).toContain("Use letters");
  });

  it("rejects duplicate names in the same workspace root", () => {
    const errors = validateCreateSpaceInput(
      {
        prompt: "Build Kata Cloud",
        name: "KATA-MVP",
        path: "/workspace/project-a/"
      },
      existingSpaces
    );

    expect(errors.name).toContain("already exists");
  });

  it("allows duplicate names when workspace root is different", () => {
    const errors = validateCreateSpaceInput(
      {
        prompt: "Build Kata Cloud",
        name: "kata-mvp",
        path: "/workspace/project-b"
      },
      existingSpaces
    );

    expect(errors).toEqual({});
  });

  it("rejects invalid repo references", () => {
    const errors = validateCreateSpaceInput(
      {
        prompt: "Build Kata Cloud",
        name: "kata-mvp-2",
        path: "/workspace/project-b",
        repo: "not a repo"
      },
      []
    );

    expect(errors.repo).toContain("valid URL");
  });
});
