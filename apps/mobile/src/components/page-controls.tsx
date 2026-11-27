import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";

/** The controls over a page's list (tabs, search, a row that opens more): the page's side inset,
 * 12 pt above the group and between them. What they control sits 16 pt under the last. */
export function PageControls({ children }: { children: ReactNode }) {
  return <View className="gap-3 px-5 pt-3">{children}</View>;
}
