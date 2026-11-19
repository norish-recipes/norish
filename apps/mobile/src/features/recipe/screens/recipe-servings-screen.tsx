import React from "react";
import { Text, View } from "react-native";
import { useServingsStepper } from "@/components/servings-stepper";
import { SheetBody } from "@/components/sheet";
import { Stepper } from "@/components/stepper";
import { ToggleChip } from "@/components/toggle-chip";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import {
  servingsDown,
  servingsUp,
  useLoadedPageRecipe,
  usePageServings,
  useRecipePageStore,
} from "@norish/shared-react/recipes";

import { RecipeSheetGate } from "../components/recipe-sheet-gate";

const MULTIPLIERS = [0.5, 1, 2, 3, 4];
const LABEL = "text-muted px-1 text-[13px] font-semibold";

/** The Servings body: step the servings or pick a scale; each change scales the page. */
function ServingsBody() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const setServings = useRecipePageStore((state) => state.setServings);
  const original = recipe.servings || 1;
  const stepper = useServingsStepper(servings);
  const picked = MULTIPLIERS.find((multiplier) => original * multiplier === servings);

  return (
    <SheetBody contentClassName="gap-3">
      <Stepper
        {...stepper}
        wide
        testID="recipe-servings-sheet"
        onDecrement={() => setServings(servingsDown(servings))}
        onIncrement={() => setServings(servingsUp(servings))}
      >
        <View testID="recipe-servings-sheet-value">
          <Text className="text-foreground text-base font-semibold">
            {intl.formatMessage({ id: "recipes.glanceBar.servings" }, { count: servings })}
          </Text>
        </View>
      </Stepper>
      <Text className={LABEL}>{intl.formatMessage({ id: "recipes.detail.multiplier" })}</Text>
      <View className="flex-row gap-2">
        {MULTIPLIERS.map((multiplier) => (
          <ToggleChip
            key={multiplier}
            even
            active={picked === multiplier}
            label={multiplier === 0.5 ? "½×" : `${multiplier}×`}
            testID={`recipe-multiplier-${multiplier}`}
            onPress={() => {
              setServings(original * multiplier);
              router.back();
            }}
          />
        ))}
      </View>
    </SheetBody>
  );
}

export function RecipeServingsScreen() {
  const intl = useIntl();

  return (
    <RecipeSheetGate
      name="recipe-servings"
      title={intl.formatMessage({ id: "recipes.form.servings" })}
    >
      <ServingsBody />
    </RecipeSheetGate>
  );
}
