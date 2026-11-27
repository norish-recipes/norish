import React from "react";
import { View } from "react-native";
import { Ionicons } from "@/components/icon";
import { NativeMenu } from "@/components/native-menu";
import { useTokenColor } from "@/hooks/use-token-color";
import { useText } from "@/lib/i18n/use-text";

export type SectionActions = {
  markAllDone?: () => void;
  deleteDone?: () => void;
  clearAll: () => void;
};

/** A section's kebab: Mark all done, Delete done and Clear all, in iOS's own menu. */
export function SectionMenu({
  actions,
  label,
  testID,
}: {
  actions: SectionActions;
  label: string;
  testID: string;
}) {
  const color = useTokenColor("foreground");
  const text = useText();

  return (
    <NativeMenu
      items={[
        ...(actions.markAllDone
          ? [
              {
                key: "mark-all-done",
                label: text("groceries.store.markAllDone"),
                systemImage: "checkmark",
                onPress: actions.markAllDone,
              },
            ]
          : []),
        ...(actions.deleteDone
          ? [
              {
                key: "delete-done",
                label: text("groceries.store.deleteDone"),
                systemImage: "trash",
                destructive: true,
                onPress: actions.deleteDone,
              },
            ]
          : []),
        {
          key: "clear-all",
          label: text("groceries.store.clearAll"),
          systemImage: "trash",
          destructive: true,
          onPress: actions.clearAll,
        },
      ]}
      label={label}
      testID={testID}
    >
      <View className="size-9 items-center justify-center">
        <Ionicons color={color} name="ellipsis-vertical" size={18} />
      </View>
    </NativeMenu>
  );
}
