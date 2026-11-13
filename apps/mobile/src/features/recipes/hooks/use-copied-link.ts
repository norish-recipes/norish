import { use, useEffect, useState } from "react";
import { copiedLinkToOffer } from "@/features/recipes/utils/copied-link";
import { ServerAddressContext } from "@/lib/network/server-address";
import * as Clipboard from "expo-clipboard";

/** The clipboard's link worth offering, read once as the sheet opens. `hasUrlAsync` raises no paste
 * prompt, so only a clipboard holding a URL is read and prompts. */
export function useCopiedLink(): string | null {
  const serverAddress = use(ServerAddressContext);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const hasUrl = await Clipboard.hasUrlAsync().catch(() => false);
      const url = hasUrl ? await Clipboard.getUrlAsync().catch(() => null) : null;

      if (!isCancelled) setLink(copiedLinkToOffer({ hasUrl, url, serverAddress }));
    })();

    return () => {
      isCancelled = true;
    };
  }, [serverAddress]);

  return link;
}
