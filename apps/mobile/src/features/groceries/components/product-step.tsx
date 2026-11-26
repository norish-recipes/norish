import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/card";
import { Checkmark } from "@/components/checkmark";
import { PillButton } from "@/components/pill-button";
import { SectionLabel } from "@/components/section-label";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SliceHairline } from "@/components/slice-row";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProductRow, useProductField } from "@norish/shared-react/groceries";
import type { StoreDto } from "@norish/shared/contracts";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

type Field = ReturnType<typeof useProductField>;

/** One product of the shop or the Store: its name and pack, its price, a check where it is the pick. */
function ProductOption({
  row,
  picked,
  first,
  onPick,
}: {
  row: ProductRow;
  picked: boolean;
  first: boolean;
  onPick: () => void;
}) {
  const intl = useIntl();
  const format = (amount: number) => formatShelfPrice(intl.locale, amount, row.currency);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      className="min-h-14 flex-row items-center gap-3 px-4 py-2.5"
      testID="product-option"
      onPress={onPick}
    >
      <SliceHairline first={first} />
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-base" numberOfLines={1}>
          {row.name}
        </Text>
        {row.packWords ? (
          <Text className="text-muted text-[13px]" numberOfLines={1}>
            {row.packWords}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text className="text-foreground text-base font-semibold tabular-nums">
          {format(row.price)}
        </Text>
        {row.regularPrice === null ? null : (
          <Text className="text-muted text-[13px] line-through">{format(row.regularPrice)}</Text>
        )}
      </View>
      <View className="size-5 items-center justify-center">{picked ? <Checkmark /> : null}</View>
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2" testID="product-group">
      <SectionLabel>{title}</SectionLabel>
      <Card>{children}</Card>
    </View>
  );
}

/** Store Product search, a step of the edit sheet: type to ask the shop, tap a product to hold
 * it, or type the price yourself. Nothing is written here; the sheet's Save commits the choice. */
export function ProductStep({
  store,
  field,
  linked,
  onBack,
}: {
  store: StoreDto;
  field: Field;
  /** Whether the grocery is linked to a product now, which can be let go. */
  linked: boolean;
  onBack: () => void;
}) {
  const intl = useIntl();
  const text = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const [muted, danger] = useThemeColor(["muted", "danger"] as const);
  const [typing, setTyping] = useState(false);
  const rowsOf = (rows: ProductRow[]) =>
    rows.map((row, index) => (
      <ProductOption
        key={row.key}
        first={index === 0}
        picked={row.key === field.picked}
        row={row}
        onPick={() => field.takeTapped(row)}
      />
    ));

  return (
    <Sheet
      back
      confirm={{ label: text("common.actions.done"), onPress: onBack }}
      name="grocery-product"
      secondary={
        typing
          ? []
          : [
              {
                label: text("groceries.mobile.typePrice"),
                symbol: "pencil",
                onPress: () => setTyping(true),
              },
            ]
      }
      subtitle={store.name}
      title={text("groceries.mobile.product")}
      onClose={onBack}
    >
      <SheetBody>
        <TextField>
          <SheetInput
            // eslint-disable-next-line jsx-a11y-x/no-autofocus -- the search opens focused, which also asks the Store what it knows
            autoFocus
            accessibilityLabel={text("groceries.picker.searchPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            editable={field.canSearch}
            placeholder={text(
              field.canSearch
                ? "groceries.picker.searchPlaceholder"
                : "groceries.picker.cannotSearch"
            )}
            prefix={<Ionicons color={muted} name="search" size={18} />}
            returnKeyType="search"
            testID="product-search"
            value={field.term}
            onChangeText={field.onTermInput}
            onClear={() => field.onTermInput("")}
            onFocus={field.ask}
          />
        </TextField>

        {field.knownRows.length > 0 ? (
          <Group title={text("groceries.picker.knownGroup")}>{rowsOf(field.knownRows)}</Group>
        ) : null}
        {field.isSearching || field.shopRows.length > 0 ? (
          <Group
            title={
              field.isSearching
                ? text("groceries.picker.searching", { store: store.name })
                : text("groceries.picker.shopGroup")
            }
          >
            {rowsOf(field.shopRows)}
          </Group>
        ) : null}
        {field.foundNothing && !field.picked ? (
          <Text className="text-muted px-2 text-[13px]">
            {text("groceries.picker.nothingFound", { store: store.name })}
          </Text>
        ) : null}
        {field.noAnswer && !field.picked ? (
          <Text className="text-muted px-2 text-[13px]" testID="product-no-answer">
            {text("groceries.picker.noAnswer", { store: store.name })}
          </Text>
        ) : null}

        {linked && !field.unlinked ? (
          <View className="items-center">
            <PillButton
              label={text("groceries.picker.unlink")}
              testID="product-unlink"
              tone="danger"
              onPress={field.unlink}
            />
          </View>
        ) : null}

        {typing ? (
          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <SectionLabel>{text("groceries.picker.byHandPrice")}</SectionLabel>
              <TextField isInvalid={field.priceInvalid}>
                <SheetInput
                  accessibilityLabel={text("groceries.picker.byHandPrice")}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  testID="product-price"
                  value={field.manualPrice}
                  onChangeText={field.editPrice}
                />
              </TextField>
            </View>
            <View className="w-28 gap-2">
              <SectionLabel>{text("groceries.picker.byHandCurrency")}</SectionLabel>
              <TextField isInvalid={field.currencyInvalid}>
                <SheetInput
                  accessibilityLabel={text("groceries.picker.byHandCurrency")}
                  autoCapitalize="characters"
                  maxLength={3}
                  placeholder={field.suggestedCurrency}
                  testID="product-currency"
                  value={field.manualCurrency}
                  onChangeText={field.editCurrency}
                />
              </TextField>
            </View>
          </View>
        ) : null}
        {typing && (field.priceInvalid || field.currencyInvalid) ? (
          <Text className="px-2 text-[13px]" style={{ color: danger }} testID="product-invalid">
            {text(
              field.priceInvalid
                ? "groceries.picker.invalidPrice"
                : "groceries.picker.invalidCurrency"
            )}
          </Text>
        ) : null}
      </SheetBody>
    </Sheet>
  );
}
