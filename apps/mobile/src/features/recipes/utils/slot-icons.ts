import type { Image } from "@expo/ui/swift-ui";
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

import type { Slot } from "@norish/shared/contracts";

/** A slot's SF Symbol, for native menus and chips. */
export const SLOT_SYMBOLS: Record<Slot, ComponentProps<typeof Image>["systemName"]> = {
  Breakfast: "sunrise",
  Lunch: "sun.max",
  Dinner: "moon",
  Snack: "sparkles",
};

/** A slot's glyph where a native symbol is not worth a host view. */
export const SLOT_GLYPHS: Record<Slot, ComponentProps<typeof Ionicons>["name"]> = {
  Breakfast: "partly-sunny-outline",
  Lunch: "sunny-outline",
  Dinner: "moon-outline",
  Snack: "sparkles-outline",
};
