import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import type { ContentList, EntryContentList, PickerKind } from "@norish/shared-react/lists";
import { ENTRY_KINDS } from "@norish/shared-react/lists";

export const LIST_ICONS: Record<EntryContentList, ComponentProps<typeof Ionicons>["name"]> = {
  tags: "pricetag-outline",
  cuisines: "globe-outline",
  categories: "restaurant-outline",
};

/** The singular of a list, as the copy under `settings.content.panel` keys it. */
export const LIST_ONE: Record<ContentList, PickerKind | "ingredient"> = {
  ...ENTRY_KINDS,
  ingredients: "ingredient",
};
