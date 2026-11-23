import type { ReactNode } from "react";
import React, { Children } from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

/** A titled iOS grouped list: rounded rows on the surface, a hairline between them. `inset` starts
 * the hairline under the title (not under the icon tile) for rows with no tile. */
export function SettingsGroup({
  title,
  inset = false,
  testID,
  children,
}: {
  title?: string;
  inset?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);

  return (
    <View className="gap-1.5 pt-4" testID={testID}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <View className="bg-surface overflow-hidden rounded-[22px]">
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <View className={`bg-line h-px ${inset ? "ml-4" : "ml-[58px]"}`} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
