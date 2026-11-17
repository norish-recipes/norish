import React from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { GroceryPrice } from "@norish/shared-react/groceries";
import { formatPackSize, formatShelfPrice } from "@norish/shared/lib/format-price";
import { packSizeOf } from "@norish/shared/lib/pack-size";

/** A product the form holds that the list does not price yet: a pick, or a Store's own link. */
export type HeldProduct = { name: string; detail: string };

/** The Store Product a grocery is priced by, and its cost; a held product (just chosen, or not on
 * the list) has none. With `onPress` the row opens the product search, and shows while empty. */
export function ProductRow({
  price,
  held = null,
  onPress,
}: {
  price: GroceryPrice;
  held?: HeldProduct | null;
  onPress?: () => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const priced = held === null && price.status === "priced" ? price : null;

  if (!held && !priced && !onPress) return null;

  const format = (amount: number, currency: string) =>
    formatShelfPrice(intl.locale, amount, currency);
  let name = intl.formatMessage({ id: "groceries.mobile.chooseProduct" });
  let detail: React.ReactNode = null;
  let cost: string | null = null;

  if (held) {
    ({ name } = held);
    detail = held.detail;
  } else if (priced) {
    const { product, regularCost } = priced;
    const pack = packSizeOf(product);
    const size =
      product.size ??
      (pack
        ? formatPackSize(pack, {
            per: (unit) => intl.formatMessage({ id: "groceries.price.perUnit" }, { unit }),
            pieces: (count) => intl.formatMessage({ id: "groceries.price.pieces" }, { count }),
          })
        : intl.formatMessage({ id: "groceries.price.each" }));

    name = product.name;
    cost = format(priced.cost.cost, product.currency);
    detail = (
      <>
        {[format(product.price, product.currency), size].filter(Boolean).join(" · ")}
        {regularCost === null || product.regularPrice === null ? null : (
          <Text className="line-through">{` ${format(product.regularPrice, product.currency)}`}</Text>
        )}
      </>
    );
  }

  return (
    <Pressable
      accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.product" })}
      accessibilityRole={onPress ? "button" : undefined}
      className="min-h-[52px] flex-row items-center gap-3 px-4 py-3"
      disabled={!onPress}
      testID="grocery-product"
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className={`${held || priced ? "text-foreground font-medium" : "text-muted"} text-base`}
          numberOfLines={2}
        >
          {name}
        </Text>
        {detail ? (
          <Text className="text-muted text-[13px]" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {cost ? (
        <Text className="text-foreground text-[17px] font-semibold tabular-nums">{cost}</Text>
      ) : null}
      {onPress ? <Ionicons color={muted} name="chevron-forward" size={16} /> : null}
    </Pressable>
  );
}
