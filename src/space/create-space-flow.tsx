import { useState } from "react";
import type { FormEvent } from "react";
import { parseTags, suggestSpaceNameFromPrompt, type SpaceValidationErrors } from "./validation.js";
import type { SpaceMetadata } from "./types.js";
import type { SpaceStore } from "./store.js";

type CreateSpaceFlowProps = {
  store: SpaceStore;
};

type SpaceDraft = {
  name: string;
  path: string;
  repo: string;
  description: string;
  tags: string;
};

const EMPTY_DRAFT: SpaceDraft = {
  name: "",
  path: "",
  repo: "",
  description: "",
  tags: ""
};

export function CreateSpaceFlow({ store }: CreateSpaceFlowProps) {
  const [spaces, setSpaces] = useState<SpaceMetadata[]>(() => store.loadSpaces());
  const [prompt, setPrompt] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<SpaceDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<SpaceValidationErrors>({});

  const openCreateForm = () => {
    setIsFormOpen(true);
    setErrors({});
    setDraft((currentDraft) => {
      if (currentDraft.name.trim()) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        name: suggestSpaceNameFromPrompt(prompt)
      };
    });
  };

  const closeCreateForm = () => {
    setIsFormOpen(false);
    setErrors({});
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = store.createSpace({
      prompt,
      name: draft.name,
      path: draft.path,
      repo: draft.repo,
      description: draft.description,
      tags: parseTags(draft.tags)
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setSpaces(result.spaces);
    setDraft({
      ...EMPTY_DRAFT,
      name: suggestSpaceNameFromPrompt(prompt)
    });
    setErrors({});
    setIsFormOpen(false);
  };

  return (
    <main className="app">
      <h1>Space Creation</h1>
      <p>Start with a prompt, then create a space with metadata that persists across relaunches.</p>

      <section className="section">
        <label htmlFor="prompt-input">
          Project Prompt
          <textarea
            id="prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe what you want to build..."
          />
        </label>
        <div className="button-row">
          <button type="button" className="primary" onClick={openCreateForm}>
            Create space
          </button>
        </div>
      </section>

      {isFormOpen ? (
        <section className="section">
          <form onSubmit={onSubmit}>
            <div className="grid">
              <label htmlFor="space-name">
                Space Name
                <input
                  id="space-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      name: event.target.value
                    }))
                  }
                />
                {errors.name ? <p className="error">{errors.name}</p> : null}
              </label>

              <label htmlFor="space-path">
                Workspace Root Path
                <input
                  id="space-path"
                  value={draft.path}
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      path: event.target.value
                    }))
                  }
                  placeholder="/Users/me/dev/my-project"
                />
                {errors.path ? <p className="error">{errors.path}</p> : null}
              </label>
            </div>

            <label htmlFor="space-repo">
              Repo Link (optional)
              <input
                id="space-repo"
                value={draft.repo}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    repo: event.target.value
                  }))
                }
                placeholder="https://github.com/org/repo or git@github.com:org/repo.git"
              />
              {errors.repo ? <p className="error">{errors.repo}</p> : null}
            </label>

            <label htmlFor="space-description">
              Description (optional)
              <textarea
                id="space-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    description: event.target.value
                  }))
                }
                placeholder="Short summary for this workspace."
              />
            </label>

            <label htmlFor="space-tags">
              Tags (optional)
              <input
                id="space-tags"
                value={draft.tags}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    tags: event.target.value
                  }))
                }
                placeholder="frontend, orchestrator, release"
              />
              <p className="help">Comma-separated tags</p>
            </label>

            <div className="button-row">
              <button type="submit" className="primary">
                Save space
              </button>
              <button type="button" className="secondary" onClick={closeCreateForm}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="section">
        <h2>Saved Spaces</h2>
        {spaces.length === 0 ? (
          <p>No spaces created yet.</p>
        ) : (
          <ul className="spaces">
            {spaces.map((space) => (
              <li key={space.id}>
                <strong>{space.name}</strong>
                <p className="meta">
                  {space.path}
                  {space.repo ? ` - ${space.repo}` : ""}
                </p>
                {space.description ? <p className="meta">{space.description}</p> : null}
                {space.tags.length > 0 ? (
                  <div className="tag-list">
                    {space.tags.map((tag) => (
                      <span key={`${space.id}_${tag}`}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
