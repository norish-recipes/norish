import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";

/** The parts of one field or block stacked 12 pt apart; `fill` takes the width left beside a sibling. */
export function Stack({
  children,
  fill = false,
  testID,
}: {
  children: ReactNode;
  fill?: boolean;
  testID?: string;
}) {
  return (
    <View className={`gap-3 ${fill ? "min-w-0 flex-1" : ""}`} testID={testID}>
      {children}
    </View>
  );
}

/** A picture and its stack side by side, top-aligned, 12 pt apart. */
export function SideBySide({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View className="flex-row items-start gap-3" testID={testID}>
      {children}
    </View>
  );
}
