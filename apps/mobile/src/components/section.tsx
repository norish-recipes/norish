import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

/** The heading's height: the Filters sheet's fixed one, or dense to its text or its control. */
const HEADING_HEIGHT = { regular: "min-h-[26px]", text: "min-h-4", control: "min-h-8" };

/** A small heading, an optional control beside it, then what it heads: a Filters sheet or Search
 * section. `dense` sets the heading's height to its text (or its control), as Search draws it. */
export function Section({
  title,
  trailing,
  dense = false,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  dense?: boolean;
  children?: ReactNode;
}) {
  const height = HEADING_HEIGHT[!dense ? "regular" : trailing ? "control" : "text"];

  return (
    <View className="gap-2">
      <View className={`flex-row items-center justify-between ${height}`}>
        <SectionLabel>{title}</SectionLabel>
        {trailing}
      </View>
      {children}
    </View>
  );
}
