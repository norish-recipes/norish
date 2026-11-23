import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

/** The web provider list's Iconify ids as Ionicons names; an unmapped provider gets a shield. */
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
    return <Ionicons color={color} name={ioniconName} size={size} />;
  }

  // Fallback: generic shield-account-outline from MaterialCommunityIcons
  return <MaterialCommunityIcons color={color} name="shield-account-outline" size={size} />;
}
