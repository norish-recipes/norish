import type { Stack } from "expo-router";
import type { ComponentProps } from "react";

type ScreenOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack.Screen>["options"]>,
  (...args: never[]) => unknown
>;

/** One item of a native stack header's bar (a button, menu, spacing or custom element). */
export type HeaderItem = ReturnType<
  NonNullable<ScreenOptions["unstable_headerRightItems"]>
>[number];

/** One entry of a bar menu: an action or a submenu. */
export type MenuItem = Extract<HeaderItem, { type: "menu" }>["menu"]["items"][number];
