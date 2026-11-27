import React from "react";
import { Ionicons } from "@/components/icon";
import { useTokenColor } from "@/hooks/use-token-color";

/** The kit's single-pick mark: an accent-text check at the end of the row that is picked. */
export function Checkmark() {
  const color = useTokenColor("accent-text");

  return <Ionicons color={color} name="checkmark" size={20} />;
}
