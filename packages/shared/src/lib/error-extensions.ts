export class OperationTimeoutError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(`${operationName} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
  }
}

/**
 * A failure that carries what the failing code was looking at, so a job can
 * record it on the step it died in and the job monitor can show why, not
 * only that. The detail must be JSON-able.
 */
export class ErrorWithDetail extends Error {
  constructor(
    message: string,
    public readonly detail: unknown
  ) {
    super(message);
    this.name = "ErrorWithDetail";
  }
}
