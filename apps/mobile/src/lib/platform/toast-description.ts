/** The mobile app has no browser console: a toast whose description points there shows none. */
export function mobileToastDescription(
  description: string | undefined,
  technicalDetails: string
): string | undefined {
  return description === technicalDetails ? undefined : description;
}
