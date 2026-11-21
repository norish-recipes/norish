import type { ViewProps } from "react-native";
import React from "react";
import { createMark } from "@/lib/mark";
import { requireNativeView, requireOptionalNativeModule } from "expo";

type PlacementEvent = { nativeEvent: { placement: "inline" | "expanded" } };

// Null off iOS; the accessory, and so the probe, exists only on iOS 26 and later.
const NativeProbe = requireOptionalNativeModule("TabAccessoryPlacement")
  ? requireNativeView<ViewProps & { onPlacementChange: (event: PlacementEvent) => void }>(
      "TabAccessoryPlacement"
    )
  : null;

// A mark, as the accessory and the screens that make room for it live in separate trees.
const minimised = createMark(false);

/** Whether the tab bar is minimised with its accessory inline, as UIKit last reported it. */
export const useTabBarMinimised = minimised.use;

/** Mounted inside the bottom accessory, it reports UIKit's placement of it as the bar changes. */
export function TabAccessoryPlacementProbe() {
  if (!NativeProbe) return null;

  return (
    <NativeProbe
      pointerEvents="none"
      style={{ position: "absolute", width: 0, height: 0 }}
      onPlacementChange={(event) => minimised.set(event.nativeEvent.placement === "inline")}
    />
  );
}
