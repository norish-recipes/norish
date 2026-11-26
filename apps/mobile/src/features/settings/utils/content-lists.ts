import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import type { PickerKind } from "@norish/shared-react/lists";

/** The Content page's lists, in the order of its tabs. */
export const CONTENT_LISTS = ["tags", "cuisines", "categories", "ingredients"] as const;

export type ContentList = (typeof CONTENT_LISTS)[number];

/** The lists of plain named entries; Ingredients is the catalogue. */
export type EntryContentList = Exclude<ContentList, "ingredients">;

export const ENTRY_KINDS: Record<EntryContentList, PickerKind> = {
  tags: "tag",
  cuisines: "cuisine",
  categories: "category",
};

export const LIST_ICONS: Record<ContentList, ComponentProps<typeof Ionicons>["name"]> = {
  tags: "pricetag-outline",
  cuisines: "globe-outline",
  categories: "restaurant-outline",
  ingredients: "leaf-outline",
};

export const isContentList = (value: unknown): value is ContentList =>
  CONTENT_LISTS.some((list) => list === value);

/** The singular of a list, as the copy under `settings.content.panel` keys it. */
export const LIST_ONE: Record<ContentList, PickerKind | "ingredient"> = {
  ...ENTRY_KINDS,
  ingredients: "ingredient",
};
