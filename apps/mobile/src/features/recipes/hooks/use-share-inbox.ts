import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import { appGroupInbox } from "@/features/recipes/utils/app-group-inbox";
import { drainShareInbox } from "@/features/recipes/utils/share-inbox";
import { getServerAddress } from "@/lib/network/server-address";

import { useImportRecipe } from "@norish/shared-react/recipes";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("share-inbox");

/** Imports what the Share Extension saved for later, on mount and on each return to the foreground. */
export function useShareInbox() {
  const { importRecipe, importFromPaste, importFromImages } = useImportRecipe({ stay: true });

  const drain = useEffectEvent(() => {
    const inbox = appGroupInbox();

    if (!inbox) return;
    drainShareInbox(inbox, getServerAddress(), {
      url: importRecipe,
      text: importFromPaste,
      images: importFromImages,
    }).catch((error: unknown) => log.warn({ error }, "Could not drain saved shares"));
  });

  useEffect(() => {
    drain();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") drain();
    });

    return () => subscription.remove();
  }, []);
}
