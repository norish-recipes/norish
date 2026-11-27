import type { ComponentProps } from "react";
import React from "react";
import { glyphAccessibility } from "@/lib/glyph-accessibility";
import MaterialCommunitySet from "@expo/vector-icons/MaterialCommunityIcons";

/** The app's Material Community glyph, for the few Ionicons lacks; hidden unless labelled. */
export function MaterialCommunityIcons(props: ComponentProps<typeof MaterialCommunitySet>) {
  return <MaterialCommunitySet {...glyphAccessibility(props.accessibilityLabel)} {...props} />;
}
