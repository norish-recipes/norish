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

/** The clipboard's web link that Add recipe offers first, unless it points at the Server Address. */
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
