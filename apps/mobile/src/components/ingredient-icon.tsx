import React from "react";
import { View } from "react-native";
import { ServerImage } from "@/components/server-image";

import { useIngredientIconAddress } from "@norish/shared-react/ingredients";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";

/** A food's icon, or a grey circle of its size where the food has none (or is not read yet). */
export function IngredientIcon({
  ingredientId,
  size = 28,
}: {
  ingredientId: string | null | undefined;
  size?: number;
}) {
  const { showIngredientIcons } = useHiddenItemVisibility();

  if (!showIngredientIcons) return null;

  return <Icon ingredientId={ingredientId ?? ""} size={size} />;
}

function Icon({ ingredientId, size }: { ingredientId: string; size: number }) {
  const address = useIngredientIconAddress(ingredientId);

  // The slot is a view of its own that never collapses: a picture arriving or leaving beside its
  // siblings otherwise unmounts out of order and Fabric asserts on the child index.
  return (
    <View
      className={address ? "" : "bg-default"}
      collapsable={false}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      {address ? (
        <ServerImage
          accessibilityElementsHidden
          contentFit="contain"
          path={address}
          style={{ width: size, height: size }}
        />
      ) : null}
    </View>
  );
}
