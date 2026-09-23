import { isUrl } from "@norish/shared/lib/helpers";

/**
 * The http(s) link on the clipboard, or null.
 *
 * Null covers every way the clipboard can fail to yield one: a browser without
 * the API, a read the browser refuses (no permission, no user gesture, a
 * document that is not focused), an empty clipboard, or text that is not a
 * link. A refused read is the everyday case on Safari and Firefox, which only
 * hand the clipboard over inside a user gesture, so nothing here throws and no
 * caller has to know which browser it is on.
 */
export async function readClipboardUrl(): Promise<string | null> {
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.readText !== "function") {
    return null;
  }

  try {
    const text = (await navigator.clipboard.readText()).trim();

    return isUrl(text) ? text : null;
  } catch {
    return null;
  }
}
