/** Whether a link may be handed to the browser or another app: an http or https address, nothing else. */
export function isOpenableExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);

    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
