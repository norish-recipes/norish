import React from "react";
import { View } from "react-native";
import { HintButton } from "@/components/hint-button";
import { useOnSheet } from "@/components/on-sheet";
import { SectionLabel } from "@/components/section-label";

/** The heading over a list's section, with its `help` behind an (i) where it has one. A page's
 * carries the side inset; a sheet's body owns it. `first` is the one under the page's controls. */
export function ListHeading({
  title,
  help,
  first = false,
  testID,
}: {
  title: string;
  help?: string;
  first?: boolean;
  testID?: string;
}) {
  const inset = useOnSheet() ? "" : "px-5";

  return (
    <View
      className={`${inset} ${first ? "pt-1" : "pt-5"} min-h-8 flex-row items-center gap-1`}
      testID={testID}
    >
      <SectionLabel>{title}</SectionLabel>
      {help ? <HintButton hint={help} size={16} /> : null}
    </View>
  );
}
