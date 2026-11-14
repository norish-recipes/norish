import type { ShareInbox } from "@/features/recipes/utils/share-inbox";
import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import { drainShareInbox } from "@/features/recipes/utils/share-inbox";
import { getServerAddress } from "@/lib/network/server-address";
import { Directory, File, Paths } from "expo-file-system";

import { useImportRecipe } from "@norish/shared-react/recipes";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("share-inbox");

/** The Share Extension's `share-inbox` folder in the App Group; null off iOS or before it exists. */
function appGroupInbox(): ShareInbox | null {
  const [container] = Object.values(Paths.appleSharedContainers);
  const folder = container && new Directory(container, "share-inbox");

  if (!folder?.exists) return null;
  const file = (name: string) => new File(folder, name);

  return {
    ids: () =>
      folder
        .list()
        .filter((entry): entry is File => entry instanceof File && entry.name.endsWith(".json"))
        .sort((a, b) => (a.creationTime ?? 0) - (b.creationTime ?? 0))
        .map((entry) => entry.name.slice(0, -".json".length)),
    read: async (id) => {
      const json = file(`${id}.json`);

      return json.exists ? json.text() : null;
    },
    image: (name) => {
      const image = file(name);

      return image.exists ? image : null;
    },
    remove: (id) => {
      // The JSON goes last, so an interrupted removal is found and finished next time.
      for (const entry of folder.list()) {
        if (entry.name.startsWith(`${id}-`)) entry.delete();
      }
      file(`${id}.json`).delete();
    },
  };
}

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
