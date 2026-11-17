import { use, useEffect } from "react";
import { ServerAddressContext } from "@/lib/network/server-address";
import { serverImage } from "@/lib/network/server-url";
import { Image } from "expo-image";

import { useIngredientIconAddress, useIngredientIcons } from "@norish/shared-react/ingredients";
import { iconIds } from "@norish/shared/lib/ingredient-icon-ids";

function Prefetch({ ingredientId }: { ingredientId: string }) {
  const address = use(ServerAddressContext);
  const path = useIngredientIconAddress(ingredientId);

  useEffect(() => {
    if (!path) return;
    const source = serverImage(address, path);

    void Image.prefetch(source.uri, {
      cachePolicy: "memory-disk",
      headers: "headers" in source ? source.headers : undefined,
    });
  }, [path, address]);

  return null;
}

/** `useIngredientIcons` for a page's foods, then each icon's picture pulled into the image cache so rows draw it at once. */
export function PrefetchIngredientIcons({ ids }: { ids: readonly (string | null | undefined)[] }) {
  useIngredientIcons(ids);

  return iconIds(ids).map((id) => <Prefetch key={id} ingredientId={id} />);
}
