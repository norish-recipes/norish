import type { ReactNode } from "react";
import React, { createContext, use } from "react";
import { View } from "react-native";
import { ServerImage } from "@/components/server-image";

import { useIngredientIconAddress, useListHasIcon } from "@norish/shared-react/ingredients";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";

/** Whether another food of the list has an icon, so a food without one keeps an empty slot. */
const IconSlotContext = createContext(false);

/** Wraps a list of rows: each row's `foodId` is its food's Ingredient id, whose icon says whether the
 * list has slots; `always` keeps them, for a list whose rows change under a search. */
export function IngredientIconSlots({
  rows,
  always = false,
  children,
}: {
  rows: readonly { foodId?: string | null }[];
  always?: boolean;
  children: ReactNode;
}) {
  const hasIcon = useListHasIcon(rows.map((row) => row.foodId));

  return <IconSlotContext value={always || hasIcon}>{children}</IconSlotContext>;
}

/** A food's icon; where it has none, an empty slot of its size if its list has icons, else nothing. */
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
  const slot = use(IconSlotContext);

  if (!address && !slot) return null;

  // The slot is a view of its own that never collapses: a picture arriving or leaving beside its
  // siblings otherwise unmounts out of order and Fabric asserts on the child index.
  return (
    <View collapsable={false} style={{ width: size, height: size }}>
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
