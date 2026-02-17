const DETERMINISTIC_FAILURE_TRIGGER = "fail";

export function hasDeterministicFailureTrigger(prompt: string): boolean {
  return new RegExp(`\\b${DETERMINISTIC_FAILURE_TRIGGER}\\b`, "i").test(prompt.trim());
}

export function resolveRunFailure(prompt: string): string | null {
  if (!hasDeterministicFailureTrigger(prompt)) {
    return null;
  }

  return `Deterministic failure triggered by keyword "${DETERMINISTIC_FAILURE_TRIGGER}". Remove "${DETERMINISTIC_FAILURE_TRIGGER}" from the prompt and rerun.`;
}
