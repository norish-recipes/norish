import type { Ionicons } from "@/components/icon";
import type { ComponentProps } from "react";

import type { EntryContentList } from "@norish/shared-react/lists";

export const LIST_ICONS: Record<EntryContentList, ComponentProps<typeof Ionicons>["name"]> = {
  tags: "pricetag-outline",
  cuisines: "globe-outline",
  categories: "restaurant-outline",
};
