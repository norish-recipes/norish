import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useStoreTotal } from "@norish/shared-react/groceries";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

import type { Heading } from "../utils/list-rows";
import type { SectionActions } from "./section-menu";
import { useStoreColor } from "../hooks/use-store-color";
import { SectionMenu } from "./section-menu";

type StoreHeading = Extract<Heading, { type: "store" }>;

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
