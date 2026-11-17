import type { ComponentProps } from "react";
import React from "react";
import Animated from "react-native-reanimated";
import { Loader } from "@/components/loader";

/** How far the loader sits under the brand's slogan. */
const LOADER_GAP = 40;

/** The loader under the brand's slogan, at the gap both the splash and the callback screen keep. */
export function BrandLoader({
  entering,
  label,
  testID,
}: {
  entering?: ComponentProps<typeof Animated.View>["entering"];
  label?: string;
  testID?: string;
}) {
  return (
    <Animated.View className="items-center" entering={entering} style={{ marginTop: LOADER_GAP }}>
      <Loader label={label} size="large" testID={testID} />
    </Animated.View>
  );
}
