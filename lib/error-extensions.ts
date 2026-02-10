export class OperationTimeoutError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(`${operationName} timed out after ${timeoutMs}ms`);
    this.name = "OperationTimeoutError";
  }
}
