import type React from "react";
import type { FormEvent } from "react";

type MessageInputBarProps = {
  prompt: string;
  modelLabel: string;
  disabled: boolean;
  onPromptChange: (prompt: string) => void;
  onSubmitPrompt: () => void;
};

export function CoordinatorMessageInputBar(props: MessageInputBarProps): React.JSX.Element {
  const { prompt, modelLabel, disabled, onPromptChange, onSubmitPrompt } = props;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    onSubmitPrompt();
  };

  return (
    <form className="coordinator-input" onSubmit={onSubmit}>
      <label htmlFor="space-prompt-input" className="coordinator-input__field">
        <textarea
          id="space-prompt-input"
          aria-label="Prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Ask anything or type @ for context"
          rows={3}
        />
      </label>
      <div className="coordinator-input__actions">
        <span className="coordinator-input__model">{modelLabel}</span>
        <button type="submit" className="pill-button" disabled={disabled}>
          Run Coordinator
        </button>
      </div>
    </form>
  );
}
