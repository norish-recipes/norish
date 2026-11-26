import React from "react";
import { Pressable, Text, View } from "react-native";
import { AmountName, amountNameLabel } from "@/components/amount-name";
import { DragPressable } from "@/components/drag-list/drag-list";
import { Ionicons } from "@/components/icon";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { lineOf, lineOfGroup } from "@norish/shared-react/groceries";
import { useUnitFormatter } from "@norish/shared-react/recipes";
import { formatInlineSourceBreakdown, shownAmount } from "@norish/shared/lib/grocery-grouping";

import { useStoreColor } from "../hooks/use-store-color";
import { GroceryPrice } from "./grocery-price";
import { StoreTick } from "./store-tick";

/** One food's groceries as one row, ticked as one; several fold out into a row per source, and a
 * group of one is that grocery's row, whose tap opens its sheet. */
export function GroupRow({
  group,
  store,
  subline,
  onToggle,
  onEdit,
  open,
  onToggleOpen,
}: {
  group: GroceryGroup;
  store: StoreDto | null;
  /** The line under a single source's name; several sources show their breakdown instead. */
  subline: string | null;
  onToggle: (ids: string[], isDone: boolean) => void;
  onEdit: (id: string) => void;
  /** Held above the row: the drag library remounts the rows a reorder passes. */
  open: boolean;
  onToggleOpen: () => void;
}) {
  const intl = useIntl();
  const { formatSpacedAmountUnit } = useUnitFormatter(intl.locale);
  const [muted] = useThemeColor(["muted"] as const);
  const color = useStoreColor(store?.color);
  const only = group.sources.length === 1 ? group.sources[0] : undefined;
  const amount = formatSpacedAmountUnit(group.totalAmount, group.displayUnit);
  const name = group.displayName || intl.formatMessage({ id: "groceries.item.unnamedItem" });
  const manual = intl.formatMessage({ id: "groceries.empty.manual" });
  const recipes = group.sources.filter((source) => source.recipeName).length;
  const second = only
    ? subline
    : recipes === group.sources.length
      ? intl.formatMessage({ id: "groceries.mobile.recipeCount" }, { count: recipes })
      : formatInlineSourceBreakdown(group.sources, formatSpacedAmountUnit, manual);
  const ids = group.sources.map((source) => source.grocery.id);
  const done = group.allDone;

  return (
    <View testID="grocery-row">
      <View className="flex-row items-center gap-1 pr-4 pl-2">
        <StoreTick
          checked={done}
          color={color}
          label={amountNameLabel(amount, name)}
          partial={group.anyDone && !done}
          testID={`group-tick-${group.primaryId}`}
          onPress={() => onToggle(ids, !done)}
        />
        <DragPressable
          accessibilityRole="button"
          accessibilityState={only ? undefined : { expanded: open }}
          className="min-h-[52px] flex-1 flex-row items-center gap-3.5 py-2 pl-1"
          testID={`group-${group.primaryId}`}
          onPress={() => (only ? onEdit(only.grocery.id) : onToggleOpen())}
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <AmountName amount={amount} className="text-[17px]" done={done} name={name} />
            {second ? (
              <Text className="text-muted text-sm" numberOfLines={2}>
                {second}
              </Text>
            ) : null}
          </View>
          <GroceryPrice line={lineOfGroup(group)} muted={done} />
          {only ? null : (
            <Ionicons color={muted} name={open ? "chevron-up" : "chevron-down"} size={16} />
          )}
        </DragPressable>
      </View>
      {open && !only ? (
        <View
          className="bg-default mx-2.5 mb-2.5 overflow-hidden rounded-[18px]"
          testID={`group-sources-${group.primaryId}`}
        >
          {group.sources.map(({ grocery, recipeName }, index) => (
            <SourceRow
              key={grocery.id}
              amount={formatSpacedAmountUnit(shownAmount(grocery), grocery.unit)}
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

  return (
    <View
      className={`flex-row items-center pr-3.5 pl-1.5 ${first ? "" : "border-separator border-t"}`}
    >
      <StoreTick
        checked={grocery.isDone}
        color={color}
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
        <AmountName
          amount={amount}
          className="min-w-0 flex-1 text-base"
          done={grocery.isDone}
          name={name}
          numberOfLines={1}
        />
        <GroceryPrice line={lineOf(grocery)} muted={grocery.isDone} size="small" />
      </Pressable>
    </View>
  );
}
