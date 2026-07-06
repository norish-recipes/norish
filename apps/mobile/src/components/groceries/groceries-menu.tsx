import React from "react";
import { ShellMenu } from "@/components/shell/menu";
import { Divider, Button as UIButton } from "@expo/ui/swift-ui";
import { useThemeColor } from "heroui-native";

import type { GroceryViewMode } from "./types";

type GroceriesMenuProps = {
  viewMode: GroceryViewMode;
  onViewModeChange: (mode: GroceryViewMode) => void;
};

export function GroceriesMenu({ viewMode, onViewModeChange }: GroceriesMenuProps) {
  const [mutedColor] = useThemeColor(["muted"] as const);

  return (
    <ShellMenu label="Grocery options" systemImage="gearshape" color={mutedColor}>
      <UIButton
        label="Group by Store"
        systemImage={viewMode === "store" ? "checkmark.circle.fill" : "storefront"}
        onPress={() => onViewModeChange("store")}
      />
      <UIButton
        label="Group by Recipe"
        systemImage={viewMode === "recipe" ? "checkmark.circle.fill" : "fork.knife"}
        onPress={() => onViewModeChange("recipe")}
      />
      <Divider />
      <UIButton
        label="New Store"
        systemImage="plus.circle"
        onPress={() => {
          // placeholder — store creation not yet implemented
        }}
      />
    </ShellMenu>
  );
}
