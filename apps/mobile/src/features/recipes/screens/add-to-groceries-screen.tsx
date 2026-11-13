import type { ReactNode } from "react";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { ServingsStepper } from "@/components/servings-stepper";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { ScaledFood } from "@norish/shared-react/groceries";
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
import { SheetHeader } from "../components/sheet-header";

/** Lines are only ever edited on web; the sheet takes each as the recipe has it. */
const AS_WRITTEN = {};

/** The pinned header and servings take 132 pt, the pinned footer 82 pt. */
const HEADER_SPACE = "mt-[132px]";
const PINNED_SPACE = "h-[214px]";

/** The header and servings pinned on top, the lines scrolling between them and the footer. */
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
      {/* react-native-screens sizes the scroll view minus this first child and moves it down by that
          height, so the child is header plus footer tall and the scroll view's margin undoes it. */}
      <View
        className={`absolute inset-x-0 top-0 ${PINNED_SPACE}`}
        collapsable={false}
        pointerEvents="box-none"
      >
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
        className={HEADER_SPACE}
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

/** The Add button: disabled until lines are known and ticked, busy while they go on the list. */
function AddButton({
  count,
  disabled,
  busy,
  onPress,
}: {
  count: number;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);

  return (
    <Button
      className="h-[50px] rounded-full"
      isDisabled={disabled || busy}
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
  selectedIds,
  testID,
  keptFor,
  onTheList,
  formatAmountUnit,
  onKeep,
  onToggle,
  onToggleSection,
}: {
  lines: ScaledFood[];
  other: ScaledFood[];
  title: string;
  selected: number;
  selectedIds: string[];
  testID: string;
  keptFor: (item: ScaledFood) => { id: string } | null;
  onTheList: string[];
  formatAmountUnit: (amount: number | null, unit: string | null) => string;
  onKeep: (item: ScaledFood) => void;
  onToggle: (id: string) => void;
  onToggleSection: (section: ScaledFood[], other: ScaledFood[]) => void;
}) {
  const intl = useIntl();

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
      onToggleAll={() => onToggleSection(lines, other)}
    >
      {lines.map((item, index) => {
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
            onKeep={() => onKeep(item)}
            onTheList={kept !== null && onTheList.includes(kept.id)}
            onToggle={() => onToggle(item.id)}
          />
        );
      })}
    </GroceryLinesSection>
  );
}

function GroceriesSheet({ recipe }: { recipe: FullRecipeDTO }) {
  const intl = useIntl();
  const router = useRouter();
  const { formatAmountUnit } = useUnitFormatter(intl.locale);
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
    keptFor,
    keepLine,
    toBuy,
    inPantry,
    addLines,
    isAdding,
    onTheList,
    selectedIds,
    selectedCount,
    inPantrySelectedCount,
    toggleSelect,
    toggleSection,
  } = useGroceryLines(scaledIngredients, AS_WRITTEN);

  useGroceriesPantryAndCatalogueSubscriptions();

  const loading = isLoading || pantry.isLoading;
  const ticked = selectedCount + inPantrySelectedCount;
  const section = {
    selectedIds,
    keptFor,
    onTheList,
    formatAmountUnit,
    onKeep: keepLine,
    onToggle: toggleSelect,
    onToggleSection: toggleSection,
  };

  return (
    <Frame
      footer={
        <AddButton
          busy={isAdding}
          count={ticked}
          disabled={loading || ticked === 0}
          onPress={() =>
            void addLines(scaledIngredients.filter((line) => selectedIds.includes(line.id))).then(
              (added) => added && router.back()
            )
          }
        />
      }
      servings={
        <ServingsStepper
          servings={picked}
          testID="add-to-groceries-servings"
          onDecrement={decrementServings}
          onIncrement={incrementServings}
        />
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
          {toBuy.length > 0 ? (
            <LineSection
              {...section}
              lines={toBuy}
              other={inPantry}
              selected={selectedCount}
              testID="add-to-groceries-to-buy"
              title={intl.formatMessage({ id: "groceries.panel.toBuy" })}
            />
          ) : null}
          {inPantry.length > 0 ? (
            <LineSection
              {...section}
              lines={inPantry}
              other={toBuy}
              selected={inPantrySelectedCount}
              testID="add-to-groceries-pantry"
              title={intl.formatMessage({ id: "groceries.panel.inPantry" })}
            />
          ) : null}
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
    <Frame
      footer={<AddButton disabled busy={false} count={0} onPress={() => undefined} />}
      servings={null}
      subtitle=""
    >
      <LinesSkeleton />
    </Frame>
  );
}
