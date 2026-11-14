import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Chip, Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { RoundTick } from "./round-tick";

const ROW = "flex-row items-center gap-3 px-3.5 py-2.5";
const rowClass = (first: boolean) => `${ROW} ${first ? "" : "border-separator border-t"}`;

/** A row's shell while its line loads: the tick and the name, in the row's own layout. */
export function GroceryLineRowSkeleton({ first }: { first: boolean }) {
  return (
    <View className={rowClass(first)}>
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-6 flex-1 rounded-md" />
    </View>
  );
}

/** The mark of a kept line whose food is already on the groceries list, as web's. */
function OnTheList({ testID }: { testID: string }) {
  const intl = useIntl();

  return (
    <Chip className="shrink-0" color="accent" size="sm" testID={testID} variant="soft">
      <Chip.Label>{intl.formatMessage({ id: "groceries.pantry.onTheList" })}</Chip.Label>
    </Chip>
  );
}

/**
 * One ingredient line: a round tick, the amount and the name. A line to buy can be kept ("we keep
 * this"); a kept line says when its food is already on the list.
 */
export function GroceryLineRow({
  amount,
  name,
  selected,
  first,
  canKeep,
  onTheList,
  testID,
  onToggle,
  onKeep,
}: {
  amount: string;
  name: string;
  selected: boolean;
  first: boolean;
  canKeep: boolean;
  onTheList: boolean;
  testID: string;
  onToggle: () => void;
  onKeep: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View className={rowClass(first)}>
      <Pressable
        accessibilityLabel={[amount, name].filter(Boolean).join(" ")}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        className="min-h-6 flex-1 flex-row items-center gap-3"
        testID={testID}
        onPress={onToggle}
      >
        <RoundTick selected={selected} />
        <Text className="text-foreground min-w-0 flex-1 text-base">
          {amount ? <Text className="text-accent-text font-medium">{`${amount} `}</Text> : null}
          {name}
        </Text>
      </Pressable>
      {canKeep ? (
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "groceries.panel.weKeepThis" })}
          accessibilityRole="button"
          className="bg-surface size-8 items-center justify-center rounded-full"
          testID={`${testID}-keep`}
          onPress={onKeep}
        >
          <Ionicons color={muted} name="file-tray-full-outline" size={16} />
        </Pressable>
      ) : onTheList ? (
        <OnTheList testID={`${testID}-on-the-list`} />
      ) : null}
    </View>
  );
}
