export type McpToolFailure = "not_found" | "forbidden" | "conflict" | "invalid";

export class McpToolError extends Error {
  readonly failure: McpToolFailure;

  constructor(failure: McpToolFailure, message: string) {
    super(message);
    this.name = "McpToolError";
    this.failure = failure;
  }
}

export function notFound(): McpToolError {
  return new McpToolError("not_found", "Recipe not found.");
}

export function forbidden(message: string): McpToolError {
  return new McpToolError("forbidden", message);
}

export function conflict(message: string): McpToolError {
  return new McpToolError("conflict", message);
}

export function invalid(message: string): McpToolError {
  return new McpToolError("invalid", message);
}
