import React from "react";
import { Pressable, View } from "react-native";
import { AmountName, amountNameLabel } from "@/components/amount-name";
import { GlassIconButton } from "@/components/glass";
import { Tick } from "@/components/tick";
import { Chip, Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

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

  return (
    <View className={rowClass(first)}>
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
        <GlassIconButton
          label={intl.formatMessage({ id: "groceries.panel.weKeepThis" })}
          size="small"
          symbol="tray.full"
          testID={`${testID}-keep`}
          onPress={onKeep}
        />
      ) : onTheList ? (
        <OnTheList testID={`${testID}-on-the-list`} />
      ) : null}
    </View>
  );
}
