import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Sheet, SheetScrollView } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Input, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ProductRow, useProductField } from "@norish/shared-react/groceries";
import type { StoreDto } from "@norish/shared/contracts";
import { formatShelfPrice } from "@norish/shared/lib/format-price";

import { FormCard } from "./form-parts";

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
  const [accent] = useThemeColor(["accent"] as const);
  const format = (amount: number) => formatShelfPrice(intl.locale, amount, row.currency);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      className={`min-h-14 flex-row items-center gap-3 px-4 py-2.5 ${first ? "" : "border-separator border-t"}`}
      testID="product-option"
      onPress={onPick}
    >
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
      <View className="size-5 items-center justify-center">
        {picked ? <Ionicons color={accent} name="checkmark" size={18} /> : null}
      </View>
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2" testID="product-group">
      <Text className="text-muted px-2 text-[13px] font-medium">{title}</Text>
      <FormCard>{children}</FormCard>
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
      actions={
        <Button
          className="h-[50px]"
          testID={typing ? "product-done" : "product-type-price"}
          variant={typing ? "primary" : "secondary"}
          onPress={typing ? onBack : () => setTyping(true)}
        >
          <Button.Label className="font-semibold">
            {text(typing ? "common.actions.done" : "groceries.mobile.typePrice")}
          </Button.Label>
        </Button>
      }
      name="grocery-product"
      title={text("groceries.picker.productLabel", { store: store.name })}
      onClose={onBack}
    >
      <SheetScrollView contentClassName="gap-4">
        <View className="justify-center">
          <View className="absolute left-4 z-10" pointerEvents="none">
            <Ionicons color={muted} name="search" size={18} />
          </View>
          <TextField>
            <Input
              // eslint-disable-next-line jsx-a11y-x/no-autofocus -- the search opens focused, which also asks the Store what it knows
              autoFocus
              accessibilityLabel={text("groceries.picker.searchPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              className="h-[52px] rounded-[18px] pr-4 pl-11 text-[17px]"
              editable={field.canSearch}
              placeholder={text(
                field.canSearch
                  ? "groceries.picker.searchPlaceholder"
                  : "groceries.picker.cannotSearch"
              )}
              returnKeyType="search"
              testID="product-search"
              value={field.term}
              onChangeText={field.onTermInput}
              onFocus={field.ask}
            />
          </TextField>
        </View>

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
          <Pressable
            accessibilityRole="button"
            className="self-start px-2"
            testID="product-unlink"
            onPress={field.unlink}
          >
            <Text className="text-muted text-[15px] font-medium">
              {text("groceries.picker.unlink")}
            </Text>
          </Pressable>
        ) : null}

        {typing ? (
          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Text className="text-muted px-2 text-[13px] font-medium">
                {text("groceries.picker.byHandPrice")}
              </Text>
              <TextField isInvalid={field.priceInvalid}>
                <Input
                  accessibilityLabel={text("groceries.picker.byHandPrice")}
                  className="h-[52px] rounded-[18px] px-4 text-[17px]"
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  testID="product-price"
                  value={field.manualPrice}
                  onChangeText={field.editPrice}
                />
              </TextField>
            </View>
            <View className="w-28 gap-2">
              <Text className="text-muted px-2 text-[13px] font-medium">
                {text("groceries.picker.byHandCurrency")}
              </Text>
              <TextField isInvalid={field.currencyInvalid}>
                <Input
                  accessibilityLabel={text("groceries.picker.byHandCurrency")}
                  autoCapitalize="characters"
                  className="h-[52px] rounded-[18px] px-4 text-[17px]"
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
      </SheetScrollView>
    </Sheet>
  );
}
