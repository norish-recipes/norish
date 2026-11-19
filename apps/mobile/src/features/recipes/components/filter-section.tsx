import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { SectionLabel } from "@/components/section-label";

/** One Filters sheet section: a small heading, an optional control beside it, then its choices. */
export function FilterSection({
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
