import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import { appGroupInbox } from "@/lib/offline/app-group-inbox";
import { offlineEngine } from "@/lib/offline/engine";
import { drainShareInbox } from "@/lib/offline/share-inbox";

import { useImportRecipe, useRereadPendingRecipes } from "@norish/shared-react/recipes";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("share-inbox");

/** Imports the signed-in owner's saved shares on mount, once the owner is known, and on each foreground. */
export function useShareInbox() {
  const { importRecipe, importFromPaste, importFromImages } = useImportRecipe({ stay: true });
  const rereadPending = useRereadPendingRecipes();

  const drain = useEffectEvent(() => {
    const inbox = appGroupInbox();

    if (!inbox) return;
    // Read before each item: a share imports only into the account and server it was shared to.
    drainShareInbox(inbox, () => offlineEngine.shareAccount(), {
      url: importRecipe,
      text: importFromPaste,
      images: importFromImages,
      reconcile: rereadPending,
    }).catch((error: unknown) => log.warn({ error }, "Could not drain saved shares"));
  });

  useEffect(() => {
    drain();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") drain();
    });
    const unsubscribe = offlineEngine.cache.subscribe(() => drain());

    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);
}
