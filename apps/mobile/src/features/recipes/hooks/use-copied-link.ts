import { use, useEffect, useState } from "react";
import { copiedLinkFromPasteboard } from "@/features/recipes/utils/copied-link";
import { ServerAddressContext } from "@/lib/network/server-address";
import { hasProbableWebUrl } from "@/lib/pasteboard-link";
import * as Clipboard from "expo-clipboard";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("copied-link");

/** The clipboard's link worth offering, read once as the sheet opens. Only a pasteboard that
 * probably holds a link is read, and the read prompts. */
export function useCopiedLink(): string | null {
  const serverAddress = use(ServerAddressContext);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void copiedLinkFromPasteboard({
      pasteboard: {
        probableWebUrl: hasProbableWebUrl,
        hasUrl: () => Clipboard.hasUrlAsync(),
        readText: () => Clipboard.getStringAsync(),
      },
      serverAddress,
      onError: (error) => log.warn({ error }, "Could not check or read the clipboard"),
    }).then((offered) => {
      if (!isCancelled) setLink(offered);
    });

    return () => {
      isCancelled = true;
    };
  }, [serverAddress]);

  return link;
}
