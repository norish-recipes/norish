import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/**
 * Maps Iconify icon IDs (used by the web provider list) to @expo/vector-icons names.
 * Only the most common providers are mapped; everything else falls back to a
 * generic shield icon.
 */
const ICONIFY_TO_IONICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  "mdi:github": "logo-github",
  "simple-icons:github": "logo-github",
  "flat-color-icons:google": "logo-google",
  "devicon:google": "logo-google",
  "mdi:google": "logo-google",
  "mdi:apple": "logo-apple",
  "simple-icons:apple": "logo-apple",
  "mdi:discord": "logo-discord",
  "simple-icons:discord": "logo-discord",
};

interface ProviderIconProps {
  /** Iconify icon ID from the backend (e.g. "mdi:github", "flat-color-icons:google") */
  icon: string;
  size?: number;
  color?: string;
}

export function ProviderIcon({ icon, size = 20, color }: ProviderIconProps) {
  const ioniconName = ICONIFY_TO_IONICONS[icon];

  if (ioniconName) {
    return <Ionicons name={ioniconName} size={size} color={color} />;
  }

  // Fallback: generic shield-account-outline from MaterialCommunityIcons
  return <MaterialCommunityIcons name="shield-account-outline" size={size} color={color} />;
}
