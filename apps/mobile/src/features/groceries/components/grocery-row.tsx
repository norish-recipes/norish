import React from "react";
import { Pressable, Text, View } from "react-native";
import { AmountName, amountNameLabel } from "@/components/amount-name";
import { useIntl } from "react-intl";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import { lineOf } from "@norish/shared-react/groceries";
import { useUnitFormatter } from "@norish/shared-react/recipes";
import { shownAmount } from "@norish/shared/lib/grocery-grouping";

import { useStoreColor } from "../hooks/use-store-color";
import { GroceryPrice } from "./grocery-price";
import { StoreTick } from "./store-tick";

/** One grocery: its tick, its amount and name, and its price; a tap on the row opens its sheet. */
export function GroceryRow({
  grocery,
  store,
  subline,
  onToggle,
  onEdit,
  onDrag,
}: {
  grocery: GroceryDto;
  store: StoreDto | null;
  /** The line under the name: where it came from, how it repeats, or its Store. */
  subline: string | null;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (id: string) => void;
  /** Lifts the row; left out on a done line, which stays put. */
  onDrag?: () => void;
}) {
  const intl = useIntl();
  const { formatAmountUnit } = useUnitFormatter(intl.locale);
  const color = useStoreColor(store?.color);
  const amount = formatAmountUnit(shownAmount(grocery), grocery.unit);
  const name = grocery.name || intl.formatMessage({ id: "groceries.item.unnamedItem" });
  const done = grocery.isDone;

  return (
    <View className="flex-row items-center gap-1 pr-4 pl-2" testID="grocery-row">
      <StoreTick
        checked={done}
        color={color}
        label={amountNameLabel(amount, name)}
        testID={`grocery-tick-${grocery.id}`}
        onPress={() => onToggle(grocery.id, !done)}
      />
      <Pressable
        accessibilityRole="button"
        className="min-h-[52px] flex-1 flex-row items-center gap-3.5 py-2 pl-1"
        testID={`grocery-${grocery.id}`}
        onLongPress={onDrag}
        onPress={() => onEdit(grocery.id)}
      >
        <View className="min-w-0 flex-1 gap-0.5">
          <AmountName amount={amount} className="text-[17px]" done={done} name={name} />
          {subline ? (
            <Text className="text-muted text-sm" numberOfLines={1}>
              {subline}
            </Text>
          ) : null}
        </View>
        <GroceryPrice line={lineOf(grocery)} muted={done} />
      </Pressable>
    </View>
  );
}
