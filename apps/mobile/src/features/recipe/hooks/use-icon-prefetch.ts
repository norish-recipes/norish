import { use, useEffect } from "react";
import { ServerAddressContext } from "@/lib/network/server-address";
import { serverImage } from "@/lib/network/server-url";
import { Image } from "expo-image";

import { useIngredientIconAnswer } from "@norish/shared-react/ingredients";

/** Reads a page's foods' icons and pulls the pictures into the image cache, so rows draw them at once. */
export function useIngredientIconPrefetch(ids: readonly (string | null | undefined)[]) {
  const address = use(ServerAddressContext);
  const data = useIngredientIconAnswer(ids);

  useEffect(() => {
    const sources = Object.values(data ?? {}).flatMap((path) =>
      path ? [serverImage(address, path)] : []
    );

    if (sources.length > 0) {
      void Image.prefetch(
        sources.map(({ uri }) => uri),
        { cachePolicy: "memory-disk", headers: sources[0]?.headers }
      );
    }
  }, [data, address]);
}
