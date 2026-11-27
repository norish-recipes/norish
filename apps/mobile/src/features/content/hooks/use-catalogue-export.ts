import { useState } from "react";
import { Alert, Share } from "react-native";
import { authHeaders } from "@/lib/auth/auth-headers";
import { useText } from "@/lib/i18n/use-text";
import { getServerAddress } from "@/lib/network/server-address";
import { File, Paths } from "expo-file-system";

import { CATALOGUE_EXPORT_PATH } from "@norish/shared-react/ingredients";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("CatalogueExport");

/** Fetches the catalogue as the signed-in reader, keeps it in the cache and offers it to the share sheet. */
async function shareCatalogue() {
  const response = await fetch(`${getServerAddress()}${CATALOGUE_EXPORT_PATH}`, {
    headers: authHeaders(),
    credentials: "omit",
  });

  if (!response.ok) throw new Error(`The catalogue answered ${response.status}`);
  const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  const file = new File(Paths.cache, name?.[1] ?? "norish-ingredients.json");

  file.create({ overwrite: true });
  await file.write(await response.text());
  await Share.share({ url: file.uri });
}

/** The catalogue download, with `busy` true while it runs and an alert when it fails. */
export function useCatalogueExport() {
  const text = useText();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    const error = await shareCatalogue().then(
      () => null,
      (failure: unknown) => failure ?? new Error("The catalogue download failed")
    );

    setBusy(false);
    if (error) {
      log.error({ error }, "Catalogue download failed");
      Alert.alert(text("settings.ingredients.dataSources.downloadFailed"));
    }
  };

  return { busy, download };
}
