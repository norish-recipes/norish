import React from "react";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";

/** The kit's single-pick mark: an accent-text check at the end of the row that is picked. */
export function Checkmark() {
  const color = useTokenColor("accent-text");

  return <Ionicons color={color} name="checkmark" size={20} />;
}
