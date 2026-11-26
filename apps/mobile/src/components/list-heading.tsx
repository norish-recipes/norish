import React from "react";
import { View } from "react-native";
import { HintButton } from "@/components/hint-button";
import { SectionLabel } from "@/components/section-label";

/** The heading over a page list's section, with its `help` behind an (i) where it has one. It
 * carries the page's side inset; the spacing above it is the list's (`HeadingRow`). */
export function ListHeading({
  title,
  help,
  testID,
}: {
  title: string;
  help?: string;
  testID?: string;
}) {
  return (
    <View className="min-h-8 flex-row items-center gap-1 px-5" testID={testID}>
      <SectionLabel>{title}</SectionLabel>
      {help ? <HintButton hint={help} size={16} /> : null}
    </View>
  );
}
