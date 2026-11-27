import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";

/** Chips side by side, wrapping onto the next line, 8 pt apart. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}
