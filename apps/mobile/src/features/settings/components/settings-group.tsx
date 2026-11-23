import type { ReactNode } from "react";
import React, { Children } from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

/** A grouped iOS list, titled or not: rounded rows on the surface, a hairline between them. `inset` starts
 * the hairline under the title (not under the icon tile) for rows with no tile. */
export function SettingsGroup({
  title,
  inset = false,
  className,
  testID,
  children,
}: {
  title?: string;
  inset?: boolean;
  /** The group's own outer spacing; the default sits it 16 pt below the one above. */
  className?: string;
  testID?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);

  return (
    <View className={`gap-1.5 ${className ?? "pt-4"}`} testID={testID}>
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
