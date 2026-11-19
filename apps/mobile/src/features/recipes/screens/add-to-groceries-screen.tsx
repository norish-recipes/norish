import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { ServingsStepper } from "@/components/servings-stepper";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { groceriesStartServings } from "@/lib/add-to-groceries";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { GroceryLineControls, ScaledFood } from "@norish/shared-react/groceries";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { plannedServings } from "@norish/shared-react/calendar";
import {
  useGroceriesPantryAndCatalogueSubscriptions,
  useGroceryLines,
} from "@norish/shared-react/groceries";
import {
  useRecipeFoodsToBuy,
  useRecipeQuery,
  useRecipeSubscription,
  useUnitFormatter,
} from "@norish/shared-react/recipes";

import { GroceryLineRow, GroceryLineRowSkeleton } from "../components/grocery-line-row";
import {
  GroceryLinesSection,
  GroceryLinesSectionSkeleton,
} from "../components/grocery-lines-section";

/** Lines are only ever edited on web; the sheet takes each as the recipe has it. */
const AS_WRITTEN = {};

/** The servings label and the stepper once the recipe is known. */
function ServingsRow({ children }: { children?: ReactNode }) {
  const intl = useIntl();

  return (
    <View className="min-h-11 flex-row items-center justify-between px-2">
      <Text className="text-foreground text-base font-semibold">
        {intl.formatMessage({ id: "groceries.panel.servings" })}
      </Text>
      {children}
    </View>
  );
}

/** What the lines look like while they load: two sections of rows, in the real shells. */
function LinesSkeleton() {
  return (
    <View className="gap-3" testID="add-to-groceries-skeleton">
      {[5, 3].map((rows) => (
        <GroceryLinesSectionSkeleton key={rows}>
          {Array.from({ length: rows }, (_, index) => (
            <GroceryLineRowSkeleton key={index} first={index === 0} />
          ))}
        </GroceryLinesSectionSkeleton>
      ))}
    </View>
  );
}

/** One section of the sheet: a heading with its select-all, then its lines. */
function LineSection({
  lines,
  other,
  title,
  selected,
  testID,
  controls,
}: {
  lines: ScaledFood[];
  other: ScaledFood[];
  title: string;
  selected: number;
  testID: string;
  controls: GroceryLineControls<ScaledFood>;
}) {
  const intl = useIntl();
  const { formatSpacedAmountUnit } = useUnitFormatter(intl.locale);

  return (
    <GroceryLinesSection
      testID={testID}
      title={title}
      toggleLabel={intl.formatMessage({
        id: selected === lines.length ? "common.actions.deselectAll" : "common.actions.selectAll",
      })}
      onToggleAll={() => controls.toggleSection(lines, other)}
    >
      {lines.map((item, index) => (
        <GroceryLineRow
          key={item.id}
          amount={formatSpacedAmountUnit(item.amount, item.unit)}
          canKeep={controls.canKeep(item)}
          first={index === 0}
          name={item.ingredientName}
          selected={controls.isSelected(item.id)}
          testID={`grocery-line-${item.id}`}
          onKeep={() => controls.keep(item)}
          onTheList={controls.isOnTheList(item)}
          onToggle={() => controls.toggle(item.id)}
        />
      ))}
    </GroceryLinesSection>
  );
}

function GroceriesSheet({ recipe }: { recipe: FullRecipeDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { servings: startParam } = useLocalSearchParams<{ servings?: string }>();
  const servings = plannedServings(recipe);
  const {
    isLoading,
    servings: picked,
    incrementServings,
    decrementServings,
    scaledIngredients,
  } = useRecipeFoodsToBuy(recipe.id, servings, groceriesStartServings(startParam, servings));
  const {
    pantry,
    toBuy,
    inPantry,
    addTicked,
    isAdding,
    selectedCount,
    inPantrySelectedCount,
    controls,
  } = useGroceryLines(scaledIngredients, AS_WRITTEN);

  useGroceriesPantryAndCatalogueSubscriptions();

  const loading = isLoading || pantry.isLoading;
  const ticked = selectedCount + inPantrySelectedCount;

  return (
    <Sheet
      confirm={{
        label: intl.formatMessage({ id: "common.actions.add" }),
        disabled: isAdding,
        onPress:
          loading || ticked === 0
            ? undefined
            : () => addTicked().then((added) => added && router.back()),
      }}
      name="add-to-groceries"
      subtitle={recipe.name}
      title={intl.formatMessage({ id: "recipes.detail.addToGroceries" })}
    >
      <SheetScrollView contentClassName="gap-3">
        <ServingsRow>
          <ServingsStepper
            servings={picked}
            testID="add-to-groceries-servings"
            onDecrement={decrementServings}
            onIncrement={incrementServings}
          />
        </ServingsRow>
        {loading ? (
          <LinesSkeleton />
        ) : (
          <>
            {pantry.isUnavailable ? (
              <Text
                className="text-muted px-2 text-sm"
                testID="add-to-groceries-pantry-unavailable"
              >
                {intl.formatMessage({ id: "groceries.panel.pantryUnavailable" })}
              </Text>
            ) : null}
            {scaledIngredients.length === 0 ? (
              <Text className="text-muted py-10 text-center text-base">
                {intl.formatMessage({ id: "groceries.panel.noIngredients" })}
              </Text>
            ) : null}
            {toBuy.length > 0 ? (
              <LineSection
                controls={controls}
                lines={toBuy}
                other={inPantry}
                selected={selectedCount}
                testID="add-to-groceries-to-buy"
                title={intl.formatMessage({ id: "groceries.panel.toBuy" })}
              />
            ) : null}
            {inPantry.length > 0 ? (
              <LineSection
                controls={controls}
                lines={inPantry}
                other={toBuy}
                selected={inPantrySelectedCount}
                testID="add-to-groceries-pantry"
                title={intl.formatMessage({ id: "groceries.panel.inPantry" })}
              />
            ) : null}
          </>
        )}
      </SheetScrollView>
    </Sheet>
  );
}

/** Add to groceries: the recipe's lines at its servings, split into to buy and in your pantry. */
export function AddToGroceriesScreen() {
  const intl = useIntl();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { recipe } = useRecipeQuery(recipeId ?? null);

  useRecipeSubscription(recipeId ?? null);

  return recipe ? (
    <GroceriesSheet key={recipe.id} recipe={recipe} />
  ) : (
    <Sheet
      confirm={{ label: intl.formatMessage({ id: "common.actions.add" }) }}
      name="add-to-groceries"
      title={intl.formatMessage({ id: "recipes.detail.addToGroceries" })}
    >
      <SheetScrollView contentClassName="gap-3">
        <ServingsRow />
        <LinesSkeleton />
      </SheetScrollView>
    </Sheet>
  );
}
