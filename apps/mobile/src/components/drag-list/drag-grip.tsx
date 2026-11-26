import React from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@/components/material-icon";
import { useThemeColor } from "heroui-native";

import { DragHandle } from "./drag-list";

/** The grip a row is dragged by: a hold lifts it. */
export function DragGrip({ label, testID }: { label: string; testID?: string }) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <DragHandle>
      <View
        accessibilityLabel={label}
        className="size-8 items-center justify-center"
        testID={testID}
      >
        <MaterialCommunityIcons color={muted} name="drag" size={22} />
      </View>
    </DragHandle>
  );
}
