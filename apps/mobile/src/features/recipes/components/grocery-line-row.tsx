import React from "react";
import { Pressable, View } from "react-native";
import { AmountName, amountNameLabel } from "@/components/amount-name";
import { IconButton } from "@/components/icon-button";
import { OnTheListChip } from "@/components/on-the-list-chip";
import { SliceHairline } from "@/components/slice-row";
import { Tick } from "@/components/tick";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

const ROW = "min-h-[58px] flex-row items-center gap-3 px-4 py-2";

/** A row's shell while its line loads: the tick and the name, in the row's own layout. */
export function GroceryLineRowSkeleton() {
  return (
    <View className={ROW}>
      <SliceHairline first={false} />
      <Skeleton className="size-6 rounded-full" />
      <Skeleton className="h-6 flex-1 rounded-md" />
    </View>
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
  canKeep,
  onTheList,
  testID,
  onToggle,
  onKeep,
}: {
  amount: string;
  name: string;
  selected: boolean;
  canKeep: boolean;
  onTheList: boolean;
  testID: string;
  onToggle: () => void;
  onKeep: () => void;
}) {
  const intl = useIntl();

  return (
    <View className={ROW}>
      {/* Each line sits under its section's heading, so every one has the hairline above it. */}
      <SliceHairline first={false} />
      <Pressable
        accessibilityLabel={amountNameLabel(amount, name)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        className="min-h-6 flex-1 flex-row items-center gap-3"
        testID={testID}
        onPress={onToggle}
      >
        <Tick selected={selected} />
        <AmountName amount={amount} className="min-w-0 flex-1 text-base" name={name} />
      </Pressable>
      {canKeep ? (
        <IconButton
          icon="file-tray-full-outline"
          label={intl.formatMessage({ id: "groceries.panel.weKeepThis" })}
          testID={`${testID}-keep`}
          onPress={onKeep}
        />
      ) : onTheList ? (
        <OnTheListChip testID={`${testID}-on-the-list`} />
      ) : null}
    </View>
  );
}
