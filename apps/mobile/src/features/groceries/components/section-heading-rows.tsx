import React from "react";
import { Pressable, Text, View } from "react-native";
import { DestructiveMenuButton } from "@/components/destructive-menu-button";
import { Button, Host, Menu } from "@expo/ui/swift-ui";
import { buttonStyle, labelStyle } from "@expo/ui/swift-ui/modifiers";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useStoreTotal } from "@norish/shared-react/groceries";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

import type { Heading } from "../utils/list-rows";
import { useStoreColor } from "../hooks/use-store-color";

type StoreHeading = Extract<Heading, { type: "store" }>;
type RecipeHeading = Extract<Heading, { type: "recipe" }>;
type SectionActions = {
  markAllDone?: () => void;
  deleteDone?: () => void;
  clearAll: () => void;
};

/** A section's kebab: Mark all done, Delete done and Clear all, in iOS's own menu. */
function SectionMenu({
  actions,
  label,
  testID,
}: {
  actions: SectionActions;
  label: string;
  testID: string;
}) {
  const intl = useIntl();
  const text = (id: string) => intl.formatMessage({ id });

  return (
    <View testID={testID}>
      <Host matchContents>
        <Menu
          label={label}
          modifiers={[buttonStyle("plain"), labelStyle("iconOnly")]}
          systemImage="ellipsis"
        >
          {actions.markAllDone ? (
            <Button
              label={text("groceries.store.markAllDone")}
              systemImage="checkmark"
              onPress={actions.markAllDone}
            />
          ) : null}
          {actions.deleteDone ? (
            <DestructiveMenuButton
              label={text("groceries.store.deleteDone")}
              systemImage="trash"
              onPress={actions.deleteDone}
            />
          ) : null}
          <DestructiveMenuButton
            label={text("groceries.store.clearAll")}
            systemImage="trash"
            onPress={actions.clearAll}
          />
        </Menu>
      </Host>
    </View>
  );
}

/** The heading bar of a section: the Store's dot, its name, what is left and what it costs. */
export function StoreHeadingRow({
  heading,
  onToggleCollapsed,
  actions,
}: {
  heading: StoreHeading;
  onToggleCollapsed: () => void;
  actions: SectionActions | undefined;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const color = useStoreColor(heading.store?.color);
  const total = useStoreTotal(heading.lines, heading.store?.id ?? null);
  const name = heading.store?.name ?? intl.formatMessage({ id: "groceries.store.unsorted" });
  const allDone = heading.open === 0 && heading.done > 0;
  const key = heading.store?.id ?? "unsorted";

  return (
    <View className="bg-default h-14 flex-row items-center gap-1 pr-2 pl-4">
      <Pressable
        accessibilityLabel={intl.formatMessage({
          id: heading.collapsed ? "groceries.mobile.expand" : "groceries.mobile.collapse",
        })}
        accessibilityRole="button"
        accessibilityState={{ expanded: !heading.collapsed }}
        className="h-full min-w-0 flex-1 flex-row items-center gap-2.5"
        testID={`store-heading-${key}`}
        onPress={onToggleCollapsed}
      >
        {heading.store ? (
          allDone ? (
            <View
              className="size-4 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
              testID="store-dot"
            >
              <Ionicons color="#ffffff" name="checkmark" size={11} />
            </View>
          ) : (
            <View
              className="size-2.5 rounded-full"
              style={{ backgroundColor: color }}
              testID="store-dot"
            />
          )
        ) : null}
        <Text className="text-foreground shrink text-[17px] font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text
          className="text-muted flex-1 text-sm tabular-nums"
          numberOfLines={1}
          testID="store-meta"
        >
          {allDone
            ? intl.formatMessage({ id: "groceries.store.allDone" })
            : [
                intl.formatMessage({ id: "groceries.item.items" }, { count: heading.open }),
                total ? formatShelfPrice(intl.locale, total.amount, total.currency) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </Text>
        <Ionicons
          color={muted}
          name={heading.collapsed ? "chevron-down" : "chevron-up"}
          size={18}
        />
      </Pressable>
      {actions ? (
        <SectionMenu
          actions={actions}
          label={intl.formatMessage({ id: "groceries.store.storeActions" })}
          testID={`store-actions-${key}`}
        />
      ) : null}
    </View>
  );
}

/** A recipe's heading in the list by recipe: its name and how many lines are left. */
export function RecipeHeadingRow({
  heading,
  onClear,
}: {
  heading: RecipeHeading;
  onClear: () => void;
}) {
  const intl = useIntl();

  return (
    <View className="bg-default h-14 flex-row items-center gap-1 pr-2 pl-4">
      <Text className="text-foreground shrink text-[17px] font-semibold" numberOfLines={1}>
        {heading.name}
      </Text>
      <Text className="text-muted flex-1 pl-1.5 text-sm" numberOfLines={1}>
        {intl.formatMessage({ id: "groceries.item.items" }, { count: heading.open })}
      </Text>
      <SectionMenu
        actions={{ clearAll: onClear }}
        label={intl.formatMessage({ id: "groceries.store.recipeActions" })}
        testID={`recipe-actions-${heading.recipeId ?? "manual"}`}
      />
    </View>
  );
}

/** An Aisle's heading inside a Store's block, where its groceries are found. */
export function AisleHeadingRow({ name, count }: { name: string; count: number }) {
  return (
    <View className="px-4 pt-3.5 pb-1.5" testID="aisle-heading">
      <Text className="text-muted text-xs font-semibold tracking-[0.6px] uppercase">
        {name} <Text className="font-medium">{count}</Text>
      </Text>
    </View>
  );
}

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
