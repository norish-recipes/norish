import type { ReactNode } from "react";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { ServingsStepper } from "@/components/servings-stepper";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { plannedServings } from "@norish/shared-react/calendar";
import { useLineSelection, useLinesToBuy, useOnTheList } from "@norish/shared-react/groceries";
import {
  useRecipeFoodsToBuy,
  useRecipeQuery,
  useRecipeSubscription,
  useUnitFormatter,
} from "@norish/shared-react/recipes";

import { GroceryLineRow } from "../components/grocery-line-row";
import { GroceryLinesSection } from "../components/grocery-lines-section";
import { SheetHeader } from "../components/sheet-header";

/** Lines are only ever edited on web; the sheet takes each as the recipe has it. */
const AS_WRITTEN = {};

/** Room the pinned footer takes below the list: its padding and the 50 pt button. */
const FOOTER_SPACE = "mb-[82px]";

/**
 * The sheet's frame: the header and servings pinned on top, the lines scrolling between them and
 * the pinned footer, all directly on the sheet's glass.
 */
function Frame({
  subtitle,
  servings,
  footer,
  children,
}: {
  subtitle: string;
  servings: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const intl = useIntl();
  const router = useRouter();

  return (
    <>
      {/* react-native-screens takes a sheet's first child as a header and sizes the list below it. */}
      <View collapsable={false}>
        <View className="px-4 pt-[27px] pb-3.5">
          <SheetHeader
            closeTestID="add-to-groceries-close"
            subtitle={subtitle}
            title={intl.formatMessage({ id: "recipes.detail.addToGroceries" })}
            onClose={() => router.back()}
          />
        </View>
        <View className="mx-6 mb-3 h-[34px] flex-row items-center justify-between">
          <Text className="text-foreground text-[15px] font-medium">
            {intl.formatMessage({ id: "groceries.panel.servings" })}
          </Text>
          {servings}
        </View>
      </View>
      <ScrollView
        className={`flex-1 ${FOOTER_SPACE}`}
        contentContainerClassName="gap-3 px-4 pb-3"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        testID="add-to-groceries-sheet"
      >
        {children}
      </ScrollView>
      <View
        className="absolute inset-x-0 bottom-0 px-4 pt-3 pb-5"
        collapsable={false}
        pointerEvents="box-none"
      >
        {footer}
      </View>
    </>
  );
}

/** What the lines look like while they load: two sections of rows. */
function LinesSkeleton() {
  return (
    <View className="gap-3" testID="add-to-groceries-skeleton">
      {[5, 3].map((rows) => (
        <Skeleton
          key={rows}
          className="w-full rounded-[22px]"
          style={{ height: 50 + rows * 53 - 1 }}
        />
      ))}
    </View>
  );
}

function GroceriesSheet({ recipe }: { recipe: FullRecipeDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);
  const { formatAmountUnit } = useUnitFormatter(intl.locale);
  const servings = plannedServings(recipe);
  const {
    isLoading,
    servings: picked,
    incrementServings,
    decrementServings,
    scaledIngredients,
  } = useRecipeFoodsToBuy(recipe.id, servings, servings);
  const { pantry, keptFor, keepLine, toBuy, inPantry, addLines } = useLinesToBuy(
    scaledIngredients,
    AS_WRITTEN
  );
  const onTheList = useOnTheList(pantry.items);
  const { selectedIds, selectedCount, inPantrySelectedCount, toggleSelect, toggleSection } =
    useLineSelection({
      lines: scaledIngredients,
      toBuy,
      inPantry,
      pantryLoading: pantry.isLoading,
      pantryUnavailable: pantry.isUnavailable,
    });
  const loading = isLoading || pantry.isLoading;
  const ticked = selectedCount + inPantrySelectedCount;

  const sectionOf = (
    section: typeof toBuy,
    other: typeof toBuy,
    { title, selected, testID }: { title: string; selected: number; testID: string }
  ) => (
    <GroceryLinesSection
      count={intl.formatMessage(
        { id: "groceries.panel.selectedCount" },
        { selected, total: section.length }
      )}
      testID={testID}
      title={title}
      toggleLabel={intl.formatMessage({
        id: selected === section.length ? "common.actions.deselectAll" : "common.actions.selectAll",
      })}
      onToggleAll={() => toggleSection(section, other)}
    >
      {section.map((item, index) => {
        const kept = keptFor(item);

        return (
          <GroceryLineRow
            key={item.id}
            amount={formatAmountUnit(item.amount, item.unit)}
            canKeep={kept === null}
            first={index === 0}
            name={item.ingredientName}
            selected={selectedIds.includes(item.id)}
            testID={`grocery-line-${item.id}`}
            onKeep={() => keepLine(item)}
            onTheList={kept !== null && onTheList.includes(kept.id)}
            onToggle={() => toggleSelect(item.id)}
          />
        );
      })}
    </GroceryLinesSection>
  );

  return (
    <Frame
      footer={
        loading || scaledIngredients.length === 0 ? null : (
          <Button
            className="h-[50px] rounded-full"
            isDisabled={ticked === 0}
            testID="add-to-groceries-add"
            variant="primary"
            onPress={() =>
              void addLines(scaledIngredients.filter((line) => selectedIds.includes(line.id))).then(
                (added) => added && router.back()
              )
            }
          >
            <Ionicons color={accentForeground} name="add" size={20} />
            <Button.Label className="text-base font-semibold">
              {intl.formatMessage({ id: "groceries.panel.addCount" }, { count: ticked })}
            </Button.Label>
          </Button>
        )
      }
      servings={
        loading ? null : (
          <ServingsStepper
            servings={picked}
            testID="add-to-groceries-servings"
            onDecrement={decrementServings}
            onIncrement={incrementServings}
          />
        )
      }
      subtitle={recipe.name}
    >
      {loading ? (
        <LinesSkeleton />
      ) : (
        <>
          {pantry.isUnavailable ? (
            <Text className="text-muted px-2 text-xs" testID="add-to-groceries-pantry-unavailable">
              {intl.formatMessage({ id: "groceries.panel.pantryUnavailable" })}
            </Text>
          ) : null}
          {scaledIngredients.length === 0 ? (
            <Text className="text-muted py-10 text-center text-base">
              {intl.formatMessage({ id: "groceries.panel.noIngredients" })}
            </Text>
          ) : null}
          {toBuy.length > 0
            ? sectionOf(toBuy, inPantry, {
                title: intl.formatMessage({ id: "groceries.panel.toBuy" }),
                selected: selectedCount,
                testID: "add-to-groceries-to-buy",
              })
            : null}
          {inPantry.length > 0
            ? sectionOf(inPantry, toBuy, {
                title: intl.formatMessage({ id: "groceries.panel.inPantry" }),
                selected: inPantrySelectedCount,
                testID: "add-to-groceries-pantry",
              })
            : null}
        </>
      )}
    </Frame>
  );
}

/** Add to groceries: the recipe's lines at its servings, split into to buy and in your pantry. */
export function AddToGroceriesScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { recipe } = useRecipeQuery(recipeId ?? null);

  useRecipeSubscription(recipeId ?? null);

  return recipe ? (
    <GroceriesSheet key={recipe.id} recipe={recipe} />
  ) : (
    <Frame footer={null} servings={null} subtitle="">
      <LinesSkeleton />
    </Frame>
  );
}
