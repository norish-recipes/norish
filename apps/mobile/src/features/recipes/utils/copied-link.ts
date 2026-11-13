import { isWebLink } from "@/lib/network/host-of";
import { isOnServer } from "@/lib/network/server-url";

/** Whether a value is a link an import can open: http(s) with a host. */
export function isImportableLink(value: string): boolean {
  try {
    return isWebLink(value) && new URL(value).host !== "";
  } catch {
    return false;
  }
}

/** The copied link Add recipe offers as its first row: a URL on the clipboard that is a web link
 * and not into the own server, else null. */
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

  if (!hasUrl || !link || !isImportableLink(link) || isOnServer(serverAddress, link)) return null;

  return link;
}
