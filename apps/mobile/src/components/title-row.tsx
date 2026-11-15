import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** A tab's large title under the status bar, with what sits at its end; `className` pads below. */
export function TitleRow({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`flex-row items-center justify-between gap-2 px-5 ${className}`}
      style={{ paddingTop: insets.top + 6 }}
    >
      <Text
        accessibilityRole="header"
        className="text-foreground flex-shrink text-[34px] leading-[41px] font-semibold tracking-[-0.75px]"
        testID="large-title"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
