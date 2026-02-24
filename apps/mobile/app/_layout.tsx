import "../global.css";

import type { StyleProp, ViewStyle } from "react-native";

import { createElement, type ComponentType, type ReactNode } from "react";
import { HeroUINativeProvider } from "heroui-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

type GestureRootProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const GestureRoot = GestureHandlerRootView as unknown as ComponentType<GestureRootProps>;

export default function RootLayout() {
  return createElement(
    GestureRoot,
    { style: { flex: 1 } },
      <HeroUINativeProvider>
        <Stack />
      </HeroUINativeProvider>,
  );
}
