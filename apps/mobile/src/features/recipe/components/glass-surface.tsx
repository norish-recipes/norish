import React from "react";
import { StyleSheet, View } from "react-native";
import { Host, Rectangle } from "@expo/ui/swift-ui";
import { foregroundStyle, glassEffect } from "@expo/ui/swift-ui/modifiers";

/**
 * Native Liquid Glass behind React Native controls: lay it first in a rounded control that floats
 * over content, as cook mode's bar, its Next pill and the timer list do. `tint` colours the glass.
 */
export function GlassSurface({ radius, tint }: { radius: number; tint?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Host style={StyleSheet.absoluteFill}>
        <Rectangle
          modifiers={[
            foregroundStyle("#00000000"),
            glassEffect({
              glass: { variant: "regular", tint },
              shape: "roundedRectangle",
              cornerRadius: radius,
            }),
          ]}
        />
      </Host>
    </View>
  );
}
