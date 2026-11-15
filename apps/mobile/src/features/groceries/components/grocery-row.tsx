import React from "react";
import { Pressable, Text, View } from "react-native";
import { useIntl } from "react-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import { lineOf } from "@norish/shared-react/groceries";
import { useUnitFormatter } from "@norish/shared-react/recipes";
import { recurrencePatternOf } from "@norish/shared/contracts/recurrence";
import { shownAmount } from "@norish/shared/lib/grocery-grouping";

import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { useStoreColor } from "../hooks/use-store-color";
import { GroceryPrice } from "./grocery-price";
import { StoreTick } from "./store-tick";

/** What sits under a row's name: the recipe it came from, or how it repeats; `subline` replaces both. */
export function useSubline({
  recipeName,
  recurring,
}: {
  recipeName?: string | null;
  recurring?: RecurringGroceryDto | null;
}): string | null {
  const recurrence = useRecurrenceLabel();

  return recurring ? recurrence(recurrencePatternOf(recurring)) : (recipeName ?? null);
}

/** One grocery: its tick, its amount and name, and its price; a tap on the row opens its sheet. */
export function GroceryRow({
  grocery,
  store,
  recipeName,
  recurring,
  subline,
  onToggle,
  onEdit,
}: {
  grocery: GroceryDto;
  store: StoreDto | null;
  recipeName?: string | null;
  recurring?: RecurringGroceryDto | null;
  /** Replaces the recipe or repeat line, as the list by recipe names the Store there. */
  subline?: string | null;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const intl = useIntl();
  const { formatAmountUnit } = useUnitFormatter(intl.locale);
  const color = useStoreColor(store?.color);
  const under = useSubline({ recipeName, recurring });
  const second = subline ?? under;
  const amount = formatAmountUnit(shownAmount(grocery), grocery.unit);
  const name = grocery.name || intl.formatMessage({ id: "groceries.item.unnamedItem" });
  const done = grocery.isDone;

  return (
    <View className="flex-row items-center gap-1 pr-4 pl-2" testID="grocery-row">
      <StoreTick
        checked={done}
        color={color}
        label={[amount, name].filter(Boolean).join(" ")}
        testID={`grocery-tick-${grocery.id}`}
        onPress={() => onToggle(grocery.id, !done)}
      />
      <Pressable
        accessibilityRole="button"
        className="min-h-[52px] flex-1 flex-row items-center gap-3.5 py-2 pl-1"
        testID={`grocery-${grocery.id}`}
        onPress={() => onEdit(grocery.id)}
      >
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className={`text-[17px] ${done ? "text-muted line-through" : "text-foreground"}`}>
            {amount ? (
              <Text className={`font-medium ${done ? "text-muted" : "text-accent-text"}`}>
                {`${amount} `}
              </Text>
            ) : null}
            {name}
          </Text>
          {second ? (
            <Text className="text-muted text-sm" numberOfLines={1}>
              {second}
            </Text>
          ) : null}
        </View>
        <GroceryPrice line={lineOf(grocery)} muted={done} />
      </Pressable>
    </View>
  );
}
