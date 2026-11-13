import { isWebLink } from "@/lib/network/host-of";
import { isOnServer } from "@/lib/network/server-url";

/**
 * The copied link the Add recipe sheet offers as its first row, or null: only when the clipboard
 * says it holds a URL, that URL is a web link, and it does not point into the own server.
 */
export function copiedLinkToOffer({
  hasUrl,
  url,
  serverAddress,
}: {
  hasUrl: boolean;
  /** Read only when `hasUrl`: the read is what raises iOS's paste prompt. */
  url: string | null;
  serverAddress: string | null;
}): string | null {
  const link = url?.trim();

  if (!hasUrl || !link || !isWebLink(link) || isOnServer(serverAddress, link)) return null;

  return link;
}
