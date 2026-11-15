import React, { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabListBottomInset } from "@/components/tab-list-inset";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { PickedFood } from "@norish/shared-react/groceries";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { useSpellingRules } from "@norish/shared-react/config";
import {
  useGroceriesMutations,
  useOnTheList,
  usePantryMutations,
  usePantryQuery,
  usePantrySuggestions,
} from "@norish/shared-react/groceries";
import { useIngredientIcons, usePantryCatalogue } from "@norish/shared-react/ingredients";
import { usePlatform } from "@norish/shared-react/platform";
import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { pantryIngredientFor, searchPantry, uncoveredSuggestions } from "@norish/shared/lib/pantry";
import { foodKey } from "@norish/shared/lib/spelling-keys";

import type { PantryRow } from "../utils/pantry-rows";
import { CardSlice } from "../components/card-slice";
import { ListSwitch } from "../components/list-switch";
import { FoodRow, OnTheListChip, RowButton } from "../components/pantry-rows";
import { pantryRows } from "../utils/pantry-rows";

/** The field that both narrows the kept foods and finds catalogue foods to add. */
function FindField({
  value,
  canAdd,
  disabled,
  onChange,
  onAdd,
}: {
  value: string;
  canAdd: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  const intl = useIntl();
  const [muted, accentFg] = useThemeColor(["muted", "accent-foreground"] as const);
  const label = intl.formatMessage({ id: "groceries.pantry.fieldLabel" });

  return (
    <View
      className="bg-surface h-12 flex-row items-center gap-2.5 rounded-full pr-1.5 pl-4"
      pointerEvents={disabled ? "none" : "auto"}
    >
      <Ionicons color={muted} name="search-outline" size={18} />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="text-foreground h-full flex-1 text-base"
        maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
        placeholder={intl.formatMessage({ id: "groceries.pantry.fieldPlaceholder" })}
        placeholderTextColor={muted}
        returnKeyType="done"
        testID="pantry-field"
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onAdd}
      />
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "groceries.pantry.add" })}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd }}
        className={`size-9 items-center justify-center rounded-full ${canAdd ? "bg-accent" : "bg-default"}`}
        disabled={!canAdd}
        testID="pantry-add"
        onPress={onAdd}
      >
        <Ionicons color={canAdd ? accentFg : muted} name="add" size={20} />
      </Pressable>
    </View>
  );
}

function PantrySkeleton() {
  return (
    <View className="bg-surface mx-5 mt-3.5 overflow-hidden rounded-3xl" testID="pantry-skeleton">
      {Array.from({ length: 6 }, (_, index) => (
        <View
          key={index}
          className={`h-[52px] flex-row items-center gap-3 px-3.5 ${index === 0 ? "" : "border-separator border-t"}`}
        >
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-5 w-36 rounded-md" />
        </View>
      ))}
    </View>
  );
}

/** The Pantry: the foods the household keeps, narrowed and added to from one field. */
export function PantryScreen() {
  const intl = useIntl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rules = useSpellingRules();
  const accentText = useAccentTextColor();
  const [muted] = useThemeColor(["muted"] as const);
  const { toast } = usePlatform();
  const { items, isRead, isUnavailable } = usePantryQuery();
  const { addPantryIngredient } = usePantryMutations();
  const { createGroceriesFromData, deleteGroceries } = useGroceriesMutations();
  const { suggestions } = usePantrySuggestions();
  const onTheList = useOnTheList(items);
  const [draft, setDraft] = useState("");
  const [startedEmpty, setStartedEmpty] = useState<boolean | null>(null);
  const [folded, setFolded] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);
  const typed = draft.trim();
  const keptIds = new Set(items.map((item) => item.ingredientId));
  const matches = usePantryCatalogue(typed, intl.locale, keptIds);
  const kept = searchPantry(items, draft, intl.locale, rules);
  const offered = uncoveredSuggestions(items, suggestions, rules);

  // "From your recipes" opens when the Pantry was empty as it was first read.
  if (startedEmpty === null && isRead) setStartedEmpty(items.length === 0);

  const suggestionsOpen = folded === null ? startedEmpty === true : !folded;
  const rows = pantryRows({
    items,
    kept,
    onTheList,
    matches,
    offered,
    typed,
    suggestionsOpen,
    showAll,
  });

  useIngredientIcons([
    ...kept.map((item) => item.ingredientId),
    ...matches.map((food) => food.id),
    ...(suggestionsOpen ? offered.map((food) => food.ingredientId) : []),
  ]);

  const duplicate =
    foodKey(draft, rules) !== "" &&
    pantryIngredientFor(items, { ingredientName: draft }, rules) !== null;
  const canAdd = foodKey(draft, rules) !== "" && !duplicate;
  const keep = (food: string | PickedFood) => {
    const name = typeof food === "string" ? food : ingredientDisplayName(food, intl.locale);

    void addPantryIngredient(food, name);
    setDraft("");
  };
  // Running out of a kept food: one grocery for it, which Undo deletes; the food stays kept.
  const putOnTheList = (item: PantryIngredientDto) => {
    const name = ingredientDisplayName(item, intl.locale);
    const created = createGroceriesFromData([{ name, amount: null, unit: null }]);

    created.catch(() => undefined);
    toast.show({
      severity: "success",
      title: intl.formatMessage({ id: "groceries.pantry.putOnTheListToast" }, { name }),
      actionLabel: intl.formatMessage({ id: "groceries.pantry.undo" }),
      onActionPress: () => void created.then(deleteGroceries, () => undefined),
    });
  };

  const renderRow = (row: PantryRow) => {
    switch (row.type) {
      case "kept": {
        const name = ingredientDisplayName(row.item, intl.locale);

        return (
          <CardSlice edge={row.edge}>
            <FoodRow
              end={
                row.onList ? (
                  <OnTheListChip />
                ) : (
                  <RowButton
                    icon="cart-outline"
                    label={intl.formatMessage({ id: "groceries.pantry.putOnTheList" })}
                    testID={`pantry-put-${row.item.id}`}
                    onPress={() => putOnTheList(row.item)}
                  />
                )
              }
              ingredientId={row.item.ingredientId || null}
              name={name}
              testID={`pantry-food-${row.item.id}`}
              onPress={() =>
                router.push({ pathname: "/groceries/food", params: { id: row.item.id } })
              }
            />
          </CardSlice>
        );
      }
      case "note":
        return (
          <CardSlice edge={{ top: true, bottom: true }}>
            <Text
              className="text-muted px-4 py-[22px] text-center text-[15px]"
              testID={row.text === "empty" ? "pantry-empty" : "pantry-no-match"}
            >
              {intl.formatMessage({
                id: row.text === "empty" ? "groceries.pantry.empty" : "common.status.noResults",
              })}
            </Text>
          </CardSlice>
        );
      case "label":
        return (
          <Text className="text-muted px-7 pt-[18px] pb-2 text-xs font-semibold tracking-[0.6px] uppercase">
            {intl.formatMessage({ id: "groceries.pantry.fromCatalogue" })}
          </Text>
        );
      case "match": {
        const name = ingredientDisplayName(row.food, intl.locale);

        return (
          <CardSlice edge={row.edge}>
            <FoodRow
              end={
                <RowButton
                  accent
                  icon="add"
                  label={intl.formatMessage({ id: "groceries.pantry.addFood" }, { name })}
                  testID={`pantry-match-${row.food.id}`}
                  onPress={() =>
                    keep({
                      ingredientId: row.food.id,
                      name: row.food.name,
                      localeNames: row.food.localeNames,
                    })
                  }
                />
              }
              ingredientId={row.food.id}
              name={name}
              testID={`pantry-match-row-${row.food.id}`}
            />
          </CardSlice>
        );
      }
      case "suggestions":
        return (
          <View className="px-7 pt-[18px] pb-2">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: row.open }}
              className="flex-row items-center gap-1.5 self-start"
              testID="pantry-suggestions"
              onPress={() => setFolded(row.open)}
            >
              <Ionicons
                color={muted}
                name={row.open ? "chevron-down" : "chevron-forward"}
                size={14}
              />
              <Text className="text-muted text-xs font-semibold tracking-[0.6px] uppercase">
                {intl.formatMessage({ id: "groceries.pantry.fromYourRecipes" })}
              </Text>
            </Pressable>
            {row.open ? (
              <Text className="text-muted pt-1 text-sm">
                {intl.formatMessage({ id: "groceries.pantry.fromYourRecipesHint" })}
              </Text>
            ) : null}
          </View>
        );
      case "suggestion": {
        const name = ingredientDisplayName(row.food, intl.locale);

        return (
          <CardSlice edge={row.edge}>
            <FoodRow
              end={
                <RowButton
                  accent
                  icon="add"
                  label={intl.formatMessage({ id: "groceries.pantry.addFood" }, { name })}
                  testID={`pantry-suggestion-${row.food.ingredientId}`}
                  onPress={() => keep(row.food)}
                />
              }
              ingredientId={row.food.ingredientId}
              name={name}
              subline={intl.formatMessage(
                { id: "groceries.pantry.inRecipes" },
                { count: row.food.recipeCount }
              )}
              testID={`pantry-suggestion-row-${row.food.ingredientId}`}
            />
          </CardSlice>
        );
      }
      case "more":
        return (
          <Pressable
            accessibilityRole="button"
            className="px-7 pt-3"
            testID="pantry-show-more"
            onPress={() => setShowAll(true)}
          >
            <Text className="text-sm font-medium" style={{ color: accentText }}>
              {intl.formatMessage({ id: "groceries.pantry.showMore" })}
            </Text>
          </Pressable>
        );
    }
  };

  const header = (
    <View className="px-5 pb-3.5" style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center justify-between pb-5">
        <Text
          accessibilityRole="header"
          className="text-foreground text-[34px] leading-[41px] font-semibold tracking-[-0.75px]"
          testID="large-title"
        >
          {intl.formatMessage({ id: "groceries.page.pantry" })}
        </Text>
        <ListSwitch value="pantry" onChange={(value) => value === "list" && router.back()} />
      </View>
      {/* Drawn while the Pantry loads but taking nothing: a food added then could double one kept. */}
      <FindField
        canAdd={canAdd}
        disabled={!isRead}
        value={draft}
        onAdd={() => canAdd && keep(typed)}
        onChange={setDraft}
      />
      {typed === "" ? (
        <Text className="text-muted px-2 pt-2 text-sm">
          {intl.formatMessage({ id: "groceries.pantry.hint" })}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View className="bg-background flex-1" testID="pantry-screen">
      <FlatList
        ListEmptyComponent={
          isUnavailable ? (
            <Text className="text-muted px-5 py-6 text-center" testID="pantry-unavailable">
              {intl.formatMessage({ id: "groceries.pantry.unavailable" })}
            </Text>
          ) : (
            <PantrySkeleton />
          )
        }
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: tabListBottomInset(insets.bottom) }}
        contentInsetAdjustmentBehavior="never"
        data={isRead ? rows : []}
        keyExtractor={(row) => row.key}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => renderRow(item)}
        testID="pantry-list"
      />
      {/* Rows dissolve into the page colour before the tab bar. */}
      <View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
        pointerEvents="none"
      />
    </View>
  );
}
