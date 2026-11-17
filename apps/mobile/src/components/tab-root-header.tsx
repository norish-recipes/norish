import type { HeaderItem } from "@/lib/header-item";
import type { SharedValue } from "react-native-reanimated";
import React from "react";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { AccountMenu } from "@/components/account-menu";
import { Stack } from "expo-router";

/** How far the list scrolls before the title has faded out under the soft top edge. */
const TITLE_FADE = 28;

/** How far the list scrolls before it counts as scrolled, for what changes at rest and away. */
export const SCROLLED_PAST = 8;

/** A tab root's title on the bar's line, left (App Store style), moving up and fading with the
 * list's `offset`; its bar items beside the avatar menu, always last. */
export function TabRootHeader({
  title,
  items = [],
  offset,
}: {
  title: string;
  items?: HeaderItem[];
  offset: SharedValue<number>;
}) {
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, TITLE_FADE], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: -Math.max(0, offset.value) }],
  }));

  return (
    <Stack.Screen
      options={{
        title,
        headerShown: true,
        headerBackVisible: false,
        headerTransparent: true,
        headerShadowVisible: false,
        scrollEdgeEffects: { top: "soft" },
        // The native title stays for VoiceOver, which skips the drawn one as it fades out.
        headerTitleStyle: { color: "transparent" },
        unstable_headerLeftItems: () => [
          {
            type: "custom",
            element: (
              <Animated.Text
                accessibilityElementsHidden
                accessible={false}
                className="text-foreground text-[34px] font-semibold"
                style={titleStyle}
              >
                {title}
              </Animated.Text>
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
