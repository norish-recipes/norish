import type { ReactNode } from "react";
import React from "react";
import { Text, View } from "react-native";
import { Sheet, SheetRow, SheetScrollView } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner, useThemeColor } from "heroui-native";
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
import { ServingsStepper } from "../components/servings-stepper";

/** Lines are only ever edited on web; the sheet takes each as the recipe has it. */
const AS_WRITTEN = {};

/** The servings label, lined up with the title, and the stepper once the recipe is known. */
function ServingsRow({ children }: { children?: ReactNode }) {
  const intl = useIntl();

  return (
    <SheetRow className="h-[34px] flex-row items-center justify-between">
      <Text className="text-foreground text-[15px] font-medium">
        {intl.formatMessage({ id: "groceries.panel.servings" })}
      </Text>
      {children}
    </SheetRow>
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

/** The Add button: pressable only when given `onPress`, busy while the lines go on the list. */
function AddButton({
  count,
  busy = false,
  onPress,
}: {
  count: number;
  busy?: boolean;
  onPress?: () => void;
}) {
  const intl = useIntl();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);
  const disabled = !onPress || busy;

  return (
    <Button
      accessibilityLabel={busy ? intl.formatMessage({ id: "groceries.panel.adding" }) : undefined}
      accessibilityState={{ disabled, busy }}
      className="h-[50px] rounded-full"
      isDisabled={disabled}
      testID="add-to-groceries-add"
      variant="primary"
      onPress={onPress}
    >
      {busy ? <Spinner size="sm" /> : <Ionicons color={accentForeground} name="add" size={20} />}
      <Button.Label className="text-base font-semibold">
        {intl.formatMessage({ id: "groceries.panel.addCount" }, { count })}
      </Button.Label>
    </Button>
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
  const { formatAmountUnit } = useUnitFormatter(intl.locale);

  return (
    <GroceryLinesSection
      count={intl.formatMessage(
        { id: "groceries.panel.selectedCount" },
        { selected, total: lines.length }
      )}
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
          amount={formatAmountUnit(item.amount, item.unit)}
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
  const servings = plannedServings(recipe);
  const {
    isLoading,
    servings: picked,
    incrementServings,
    decrementServings,
    scaledIngredients,
  } = useRecipeFoodsToBuy(recipe.id, servings, servings);
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
      actions={
        <AddButton
          busy={isAdding}
          count={ticked}
          onPress={
            loading || ticked === 0
              ? undefined
              : () => void addTicked().then((added) => added && router.back())
          }
        />
      }
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
              <SheetRow>
                <Text className="text-muted text-xs" testID="add-to-groceries-pantry-unavailable">
                  {intl.formatMessage({ id: "groceries.panel.pantryUnavailable" })}
                </Text>
              </SheetRow>
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
      actions={<AddButton count={0} />}
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
