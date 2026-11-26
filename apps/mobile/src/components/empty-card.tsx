import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import { useOnSheet } from "@/components/on-sheet";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "heroui-native";

type Icon = ComponentProps<typeof Ionicons>["name"];

/** Where the card sits, each placement carrying its one margin: `screen` is a screen list's,
 * `section` is under a Settings group, `sheet` has none because the sheet body owns the inset. */
export const EMPTY_CARD_PLACEMENT = {
  screen: "mx-5",
  section: "mt-4",
  sheet: "",
} as const;

export type EmptyCardPlacement = keyof typeof EMPTY_CARD_PLACEMENT;

/** A list with nothing in it: the area's icon in muted ink on the left, the title on the right and
 * at most one action under them. The card's ground is sand on a sheet, the surface off one. */
export function EmptyCard({
  icon,
  title,
  placement,
  testID,
  action,
}: {
  icon: Icon;
  title: string;
  placement: EmptyCardPlacement;
  testID: string;
  action?: { label: string; icon: Icon; testID: string; onPress: () => void };
}) {
  const iconColor = useTokenColor("muted");
  const actionColor = useTokenColor("accent-text");
  const ground = useOnSheet() ? "bg-sand" : "bg-surface";

  return (
    <View
      className={`${ground} ${EMPTY_CARD_PLACEMENT[placement]} gap-3.5 rounded-3xl p-4.5`}
      testID={testID}
    >
      <View className="flex-row items-center gap-2.5">
        <View className="size-6 items-center justify-center">
          <Ionicons color={iconColor} name={icon} size={22} />
        </View>
        <Text className="text-foreground min-w-0 flex-1 text-lg font-semibold">{title}</Text>
      </View>
      {action ? (
        <Button
          className="bg-accent-soft h-11 rounded-full"
          testID={action.testID}
          variant="secondary"
          onPress={action.onPress}
        >
          <Ionicons color={actionColor} name={action.icon} size={18} />
          <Button.Label className="text-accent-text text-[15px] font-medium">
            {action.label}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
