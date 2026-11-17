import { use, useEffect, useState } from "react";
import { copiedLinkToOffer } from "@/features/recipes/utils/copied-link";
import { ServerAddressContext } from "@/lib/network/server-address";
import * as Clipboard from "expo-clipboard";

import PasteboardLink from "../../../../modules/pasteboard-link/src/PasteboardLinkModule";

/** Whether the pasteboard probably holds a web link, with no paste prompt. iOS also reports a link
 * copied as plain text, which `hasUrlAsync` misses. */
async function hasLink(): Promise<boolean> {
  const probable = await PasteboardLink?.hasProbableWebUrl().catch(() => false);

  return probable ?? (await Clipboard.hasUrlAsync().catch(() => false));
}

/** The clipboard's link worth offering, read once as the sheet opens. Only a pasteboard that
 * probably holds a link is read, and the read prompts. */
export function useCopiedLink(): string | null {
  const serverAddress = use(ServerAddressContext);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const hasUrl = await hasLink();
      const url = hasUrl
        ? ((await Clipboard.getUrlAsync().catch(() => null)) ??
          (await Clipboard.getStringAsync().catch(() => null)))
        : null;

      if (!isCancelled) setLink(copiedLinkToOffer({ hasUrl, url, serverAddress }));
    })();

    return () => {
      isCancelled = true;
    };
  }, [serverAddress]);

  return link;
}
