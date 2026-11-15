import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";

/** One Filters sheet section: a small uppercase heading, an optional control beside it, then its choices. */
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
        <Text className="text-muted ml-1 text-xs font-semibold tracking-wider uppercase">
          {title}
        </Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}
