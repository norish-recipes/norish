/** The mobile app has no browser console: a toast whose description points there shows none. */
export function mobileToastDescription(
  description: string | undefined,
  consoleHints: string[]
): string | undefined {
  return description !== undefined && consoleHints.includes(description) ? undefined : description;
}

/** A tRPC input check's failure carries its Zod issue list as the message: no text for a reader. */
const isIssueList = (message: string) => {
  try {
    const parsed: unknown = JSON.parse(message);

    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((issue) => typeof issue === "object" && issue !== null && "path" in issue)
    );
  } catch {
    return false;
  }
};

/** A failed write's toast body: the server's message for the reader, none for a validation error. */
export function errorBody(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error);

  return isIssueList(message) ? undefined : message;
}
