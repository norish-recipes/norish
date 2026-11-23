import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ComponentProps } from "react";
import React, { useEffect } from "react";
import Animated from "react-native-reanimated";

/** A Search page's scroll, wired to the header as the other tabs' lists are: its offset fades the title and
 * a page that mounts at rest starts it from 0. */
export function SearchScroll({
  scroll,
  ...props
}: ComponentProps<typeof Animated.ScrollView> & { scroll: TabScroll }) {
  useEffect(() => scroll.offset.set(0), [scroll.offset]);

  return (
    <Animated.ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={scroll.onScroll}
      {...props}
    />
  );
}
