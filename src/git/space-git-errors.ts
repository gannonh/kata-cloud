export const ERROR_CODES = {
  REPOSITORY_MISSING: "REPOSITORY_MISSING",
  REPOSITORY_DIRTY: "REPOSITORY_DIRTY",
  GIT_COMMAND_FAILED: "GIT_COMMAND_FAILED"
} as const;

export type SpaceGitErrorCode =
  (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class SpaceGitLifecycleError extends Error {
  readonly code: SpaceGitErrorCode;
  readonly remediation: string;
  readonly cause?: unknown;

  constructor({
    code,
    message,
    remediation,
    cause
  }: {
    code: SpaceGitErrorCode;
    message: string;
    remediation: string;
    cause?: unknown;
  }) {
    super(message);
    this.name = "SpaceGitLifecycleError";
    this.code = code;
    this.remediation = remediation;
    this.cause = cause;
  }
}

export function isSpaceGitLifecycleError(
  error: unknown
): error is SpaceGitLifecycleError {
  return error instanceof SpaceGitLifecycleError;
}
