import React from "react";
import { Pressable, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/** The folded tail of a section: how many are done, opening on tap. */
export function DoneRow({
  count,
  open,
  sectionKey,
  onToggle,
}: {
  count: number;
  open: boolean;
  sectionKey: string;
  onToggle: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      className="h-11 flex-row items-center gap-2 px-4"
      testID={`done-heading-${sectionKey}`}
      onPress={onToggle}
    >
      <Text className="text-muted flex-1 text-[15px]">
        {intl.formatMessage({ id: "groceries.store.done" }, { count })}
      </Text>
      <Ionicons color={muted} name={open ? "chevron-up" : "chevron-down"} size={16} />
    </Pressable>
  );
}
