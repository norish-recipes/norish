/** The mobile app has no browser console: a toast whose description points there shows none. */
export function mobileToastDescription(
  description: string | undefined,
  consoleHints: string[]
): string | undefined {
  return description !== undefined && consoleHints.includes(description) ? undefined : description;
}
