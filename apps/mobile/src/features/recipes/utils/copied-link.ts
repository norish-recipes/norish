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

// A scheme link, or a bare domain not glued to an address, path or another word.
const WEB_LINK = /https?:\/\/[^\s<>"]+|(?<![\w@/.:-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"]*)?/i;

/** The first web link in some text, trailing punctuation dropped and `https://` added to a bare one. */
export function firstWebLink(text: string): string | null {
  let found = WEB_LINK.exec(text)?.[0];

  if (!found) return null;

  while (/[.,;:!?)\]'"]$/.test(found)) found = found.slice(0, -1);

  return isWebLink(found) ? found : `https://${found}`;
}

/** The clipboard's web link that Add recipe offers first, unless it points at the Server Address. */
export function copiedLinkToOffer({
  hasUrl,
  text,
  serverAddress,
}: {
  hasUrl: boolean;
  /** Read only when `hasUrl`: the read is what raises iOS's paste prompt. */
  text: string | null;
  serverAddress: string | null;
}): string | null {
  const link = hasUrl && text ? firstWebLink(text) : null;

  if (!link || !isImportableLink(link) || isOnServer(serverAddress, link)) return null;

  return link;
}

export type Pasteboard = {
  /** iOS's pattern check, which also sees a link copied as text. Null where there is none. */
  probableWebUrl: (() => Promise<boolean>) | null;
  hasUrl: () => Promise<boolean>;
  readText: () => Promise<string | null>;
};

/** The link to offer for the clipboard: nothing is read unless detection says it holds one. */
export async function copiedLinkFromPasteboard({
  pasteboard,
  serverAddress,
  onError,
}: {
  pasteboard: Pasteboard;
  serverAddress: string | null;
  onError: (error: unknown) => void;
}): Promise<string | null> {
  let hasUrl: boolean;

  try {
    hasUrl = await (pasteboard.probableWebUrl ?? pasteboard.hasUrl)();
  } catch (error) {
    onError(error);
    hasUrl = await pasteboard.hasUrl().catch(() => false);
  }

  if (!hasUrl) return null;

  const text = await pasteboard.readText().catch((error: unknown) => {
    onError(error);

    return null;
  });

  return copiedLinkToOffer({ hasUrl, text, serverAddress });
}
