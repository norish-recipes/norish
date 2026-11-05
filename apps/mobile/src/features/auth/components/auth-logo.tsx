import React from "react";
import { StyleSheet, View } from "react-native";
import LogoSvg from "@/assets/images/logo.svg";

// viewBox is 2370 x 639, so aspect ratio = 639/2370
const LOGO_ASPECT_RATIO = 639 / 2370;

interface AuthLogoProps {
  /** Width of the logo in points. Defaults to 140. */
  width?: number;
  /** When true, renders without a block wrapper (for use inside a flex-row). */
  inline?: boolean;
}

export function AuthLogo({ width = 140, inline = false }: AuthLogoProps) {
  const height = Math.round(width * LOGO_ASPECT_RATIO);

  const svg = <LogoSvg width={width} height={height} />;

  if (inline) {
    return svg;
  }

  return <View style={styles.container}>{svg}</View>;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
  },
});
