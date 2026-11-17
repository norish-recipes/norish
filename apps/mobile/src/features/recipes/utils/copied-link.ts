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

/** A detected link as a web link: `https://` added only when it has no scheme of its own. */
export function withScheme(link: string): string {
  return isWebLink(link) ? link : `https://${link}`;
}

/** The clipboard's web link that Add recipe offers first, unless it points at the Server Address. */
export function copiedLinkToOffer(
  link: string | null,
  serverAddress: string | null
): string | null {
  const trimmed = link?.trim();

  if (!trimmed || !isImportableLink(trimmed) || isOnServer(serverAddress, trimmed)) return null;

  return trimmed;
}

export type Pasteboard = {
  /** iOS's link detection, null off iOS: `hasWebUrl` raises no prompt, `webUrl` is the read. */
  detection: { hasWebUrl: () => Promise<boolean>; webUrl: () => Promise<string | null> } | null;
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
  const read = (from: () => Promise<string | null>) =>
    from().catch((error: unknown) => {
      onError(error);

      return null;
    });
  const { detection } = pasteboard;
  const detected = await detection?.hasWebUrl().catch((error: unknown) => onError(error));

  if (detection && detected !== undefined) {
    const value = detected ? await read(detection.webUrl) : null;

    return copiedLinkToOffer(value && withScheme(value.trim()), serverAddress);
  }

  // Without detection only a clipboard that is one whole link is offered.
  if (!(await pasteboard.hasUrl().catch(() => false))) return null;

  return copiedLinkToOffer(await read(pasteboard.readText), serverAddress);
}
