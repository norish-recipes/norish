import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

/** A grouped iOS list, titled or not: rounded rows on the surface. Each row draws the hairline above
 * it; the list sits 1 pt up so the first row's is clipped. */
export function SettingsGroup({
  title,
  className,
  testID,
  children,
}: {
  title?: string;
  /** The group's own outer spacing; the default sits it 16 pt below the one above. */
  className?: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View className={`gap-1.5 ${className ?? "pt-4"}`} testID={testID}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <View className="bg-surface overflow-hidden rounded-[22px]">
        <View className="-mt-px">{children}</View>
      </View>
    </View>
  );
}
