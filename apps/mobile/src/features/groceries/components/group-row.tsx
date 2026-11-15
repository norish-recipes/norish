import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { lineOf, lineOfGroup } from "@norish/shared-react/groceries";
import { useUnitFormatter } from "@norish/shared-react/recipes";
import { formatInlineSourceBreakdown, shownAmount } from "@norish/shared/lib/grocery-grouping";

import { useStoreColor } from "../hooks/use-store-color";
import { GroceryPrice } from "./grocery-price";
import { useSubline } from "./grocery-row";
import { StoreTick } from "./store-tick";

/**
 * One food's groceries as a single row, ticked as one; a group of several folds out into an inset
 * block of one row per source. A group of one is that grocery's row, and a tap opens its sheet.
 */
export function GroupRow({
  group,
  store,
  recurring,
  onToggle,
  onEdit,
}: {
  group: GroceryGroup;
  store: StoreDto | null;
  /** The repeat of a single source, if it has one. */
  recurring: RecurringGroceryDto | null;
  onToggle: (ids: string[], isDone: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const intl = useIntl();
  const { formatAmountUnit } = useUnitFormatter(intl.locale);
  const [open, setOpen] = useState(false);
  const [muted] = useThemeColor(["muted"] as const);
  const color = useStoreColor(store?.color);
  const only = group.sources.length === 1 ? group.sources[0] : undefined;
  const amount = formatAmountUnit(group.totalAmount, group.displayUnit);
  const name = group.displayName || intl.formatMessage({ id: "groceries.item.unnamedItem" });
  const manual = intl.formatMessage({ id: "groceries.empty.manual" });
  const under = useSubline({ recipeName: only?.recipeName, recurring });
  const second = only
    ? under
    : formatInlineSourceBreakdown(group.sources, formatAmountUnit, manual);
  const ids = group.sources.map((source) => source.grocery.id);
  const done = group.allDone;

  return (
    <View testID="grocery-row">
      <View className="flex-row items-center gap-1 pr-4 pl-2">
        <StoreTick
          checked={done}
          color={color}
          label={[amount, name].filter(Boolean).join(" ")}
          partial={group.anyDone && !done}
          testID={`group-tick-${group.primaryId}`}
          onPress={() => onToggle(ids, !done)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={only ? undefined : { expanded: open }}
          className="min-h-[52px] flex-1 flex-row items-center gap-3.5 py-2 pl-1"
          testID={`group-${group.primaryId}`}
          onPress={() => (only ? onEdit(only.grocery.id) : setOpen(!open))}
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
          <GroceryPrice line={lineOfGroup(group)} muted={done} />
          {only ? null : (
            <Ionicons color={muted} name={open ? "chevron-up" : "chevron-down"} size={16} />
          )}
        </Pressable>
      </View>
      {open && !only ? (
        <View
          className="bg-default mx-2.5 mb-2.5 overflow-hidden rounded-[18px]"
          testID={`group-sources-${group.primaryId}`}
        >
          {group.sources.map(({ grocery, recipeName }, index) => (
            <SourceRow
              key={grocery.id}
              amount={formatAmountUnit(shownAmount(grocery), grocery.unit)}
              color={color}
              first={index === 0}
              grocery={grocery}
              name={recipeName ?? manual}
              onEdit={onEdit}
              onToggle={(id, isDone) => onToggle([id], isDone)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One source of a group: a 52 pt row with a 44 pt tick. */
function SourceRow({
  grocery,
  amount,
  name,
  color,
  first,
  onToggle,
  onEdit,
}: {
  grocery: GroceryGroup["sources"][number]["grocery"];
  amount: string;
  name: string;
  color: string | undefined;
  first: boolean;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (id: string) => void;
}) {
  const intl = useIntl();
  const accent = useAccentTextColor();

  return (
    <View
      className={`flex-row items-center pr-3.5 pl-1.5 ${first ? "" : "border-separator border-t"}`}
    >
      <StoreTick
        checked={grocery.isDone}
        color={color ?? accent}
        label={intl.formatMessage({ id: "groceries.mobile.amountFor" }, { amount, recipe: name })}
        testID={`source-tick-${grocery.id}`}
        onPress={() => onToggle(grocery.id, !grocery.isDone)}
      />
      <Pressable
        accessibilityRole="button"
        className="min-h-[52px] flex-1 flex-row items-center gap-2 pl-1"
        testID={`source-${grocery.id}`}
        onPress={() => onEdit(grocery.id)}
      >
        <Text
          className={`min-w-0 flex-1 text-base ${grocery.isDone ? "text-muted line-through" : "text-foreground"}`}
          numberOfLines={1}
        >
          {amount ? <Text className="text-accent-text font-medium">{`${amount} `}</Text> : null}
          {name}
        </Text>
        <GroceryPrice line={lineOf(grocery)} muted={grocery.isDone} size="small" />
      </Pressable>
    </View>
  );
}
