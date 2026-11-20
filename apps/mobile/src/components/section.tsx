import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

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
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View
        className={`flex-row items-center justify-between ${dense ? (trailing ? "min-h-8" : "min-h-4") : "min-h-[26px]"}`}
      >
        <SectionLabel>{title}</SectionLabel>
        {trailing}
      </View>
      {children}
    </View>
  );
}
