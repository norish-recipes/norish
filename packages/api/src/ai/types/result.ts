/**
 * Result type for AI operations.
 * Provides consistent error handling across all AI functions.
 */

export type AIResult<T> =
  | { success: true; data: T; usage?: TokenUsage }
  | { success: false; error: string; code: AIErrorCode };

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AIErrorCode =
  | "AI_DISABLED"
  | "PROVIDER_ERROR"
  | "VALIDATION_ERROR"
  | "EMPTY_RESPONSE"
  | "RATE_LIMIT"
  | "AUTH_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_INPUT"
  | "UNKNOWN";

/**
 * Create a success result.
 */
export function aiSuccess<T>(data: T, usage?: TokenUsage): AIResult<T> {
  return { success: true, data, usage };
}

/**
 * Create an error result.
 */
export function aiError<T>(error: string, code: AIErrorCode = "UNKNOWN"): AIResult<T> {
  return { success: false, error, code };
}

/**
 * Map common AI SDK errors to our error codes.
 */
export function mapErrorToCode(error: unknown): AIErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return "RATE_LIMIT";
    }

    // Auth errors
    if (
      message.includes("unauthorized") ||
      message.includes("invalid api key") ||
      message.includes("401") ||
      message.includes("403")
    ) {
      return "AUTH_ERROR";
    }

    // Network errors
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      name.includes("fetch")
    ) {
      return "NETWORK_ERROR";
    }

    // Timeout
    if (message.includes("timeout") || message.includes("timed out")) {
      return "TIMEOUT";
    }

    // Validation errors
    if (message.includes("validation") || message.includes("schema") || name.includes("zod")) {
      return "VALIDATION_ERROR";
    }
  }

  return "PROVIDER_ERROR";
}

/**
 * Create a user-friendly error message.
 */
export function getErrorMessage(code: AIErrorCode, originalMessage?: string): string {
  switch (code) {
    case "AI_DISABLED":
      return "AI features are disabled. Enable them in the admin settings.";
    case "RATE_LIMIT":
      return "AI service rate limit exceeded. Please try again later.";
    case "AUTH_ERROR":
      return "Invalid API key or authentication failed. Check your AI configuration.";
    case "NETWORK_ERROR":
      return "Could not connect to AI service. Check your network and endpoint configuration.";
    case "TIMEOUT":
      return "AI request timed out. The service may be overloaded.";
    case "VALIDATION_ERROR":
      return "AI response did not match expected format.";
    case "EMPTY_RESPONSE":
      return "AI returned an empty response. Try again or check your prompt.";
    case "INVALID_INPUT":
      return originalMessage || "Invalid input provided.";
    case "PROVIDER_ERROR":
      return originalMessage || "AI provider returned an error.";
    default:
      return originalMessage || "An unexpected error occurred.";
  }
}
