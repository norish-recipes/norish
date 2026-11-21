import type { ReactNode } from "react";
import React from "react";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { FADE_IN } from "@/features/auth/utils/motion";

/** Fades its screen in as one, filling the space the screen would. */
export function FadeInFill({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FADE_IN} style={styles.fill}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
