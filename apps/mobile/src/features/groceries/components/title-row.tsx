import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The Groceries tab's large title under the status bar, with what sits at its end. */
export function TitleRow({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row items-center justify-between px-5 pb-5"
      style={{ paddingTop: insets.top + 6 }}
    >
      <Text
        accessibilityRole="header"
        className="text-foreground text-[34px] leading-[41px] font-semibold tracking-[-0.75px]"
        testID="large-title"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
