import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

/** A small heading, an optional control beside it, then what it heads: a Filters sheet or Search section. */
export function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="min-h-[26px] flex-row items-center justify-between">
        <SectionLabel>{title}</SectionLabel>
        {trailing}
      </View>
      {children}
    </View>
  );
}
