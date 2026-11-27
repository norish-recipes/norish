import type { ComponentProps } from "react";
import React from "react";
import { glyphAccessibility } from "@/lib/glyph-accessibility";
import IoniconsSet from "@expo/vector-icons/Ionicons";

/** The app's Ionicons glyph, hidden from accessibility unless labelled. */
export function Ionicons(props: ComponentProps<typeof IoniconsSet>) {
  return <IoniconsSet {...glyphAccessibility(props.accessibilityLabel)} {...props} />;
}
