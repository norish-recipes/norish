import type { HeaderItem } from "@/lib/header-item";
import React from "react";
import { Text } from "react-native";
import { AccountMenu } from "@/components/account-menu";
import { Stack } from "expo-router";

/** A tab root's title on the bar's line, left (App Store style) and gone once the list `scrolled`,
 * its bar items beside the avatar menu, always last. */
export function TabRootHeader({
  title,
  items = [],
  scrolled,
}: {
  title: string;
  items?: HeaderItem[];
  scrolled: boolean;
}) {
  return (
    <Stack.Screen
      options={{
        title,
        headerShown: true,
        headerBackVisible: false,
        headerTransparent: true,
        headerShadowVisible: false,
        scrollEdgeEffects: { top: "soft" },
        headerTitleStyle: { color: "transparent" },
        unstable_headerLeftItems: () =>
          scrolled
            ? []
            : [
                {
                  type: "custom",
                  element: (
                    <Text
                      accessibilityRole="header"
                      className="text-foreground text-[34px] font-semibold"
                    >
                      {title}
                    </Text>
                  ),
                  hidesSharedBackground: true,
                },
              ],
        unstable_headerRightItems: () => [
          ...items,
          { type: "custom", element: <AccountMenu />, hidesSharedBackground: true },
        ],
      }}
    />
  );
}
