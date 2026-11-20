import React from "react";
import { Text } from "react-native";

/** The kit's label over a group of controls or a card. */
export function SectionLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Text className={`text-muted px-2 text-[13px] font-semibold ${className ?? ""}`}>
      {children}
    </Text>
  );
}
