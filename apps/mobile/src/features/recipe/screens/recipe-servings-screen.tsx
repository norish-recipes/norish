import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useRouter } from "expo-router";
import { TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import {
  MIN_SERVINGS,
  useLoadedPageRecipe,
  usePageServings,
  useRecipePageStore,
} from "@norish/shared-react/recipes";
import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

import { RecipeSheetGate } from "../components/recipe-sheet-gate";

const MULTIPLIERS = [0.5, 1, 2, 3, 4];

/** The Servings body: type the servings or a multiplier, or pick one; each change scales the page. */
function ServingsBody() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const setServings = useRecipePageStore((state) => state.setServings);
  const [foreground] = useThemeColor(["foreground"] as const);
  const original = recipe.servings || 1;
  const drafts = (next: number) => ({
    servings: formatAmountAsDecimal(next),
    multiplier: formatAmountAsDecimal(next / original),
  });
  const [draft, setDraft] = useState(() => drafts(servings));
  const picked = MULTIPLIERS.find((multiplier) => original * multiplier === servings);

  const type = (field: "servings" | "multiplier", text: string) => {
    const typed = Number(text.replace(",", "."));
    const next = field === "servings" ? typed : original * typed;
    const valid = next >= MIN_SERVINGS;

    setDraft({ ...(valid ? drafts(next) : draft), [field]: text });
    if (valid) setServings(next);
  };

  return (
    <SheetBody contentClassName="gap-3">
      {/* As the board draws them: the word and the × inside the capsules, the values bold. */}
      <View className="flex-row gap-2.5">
        <TextField className="flex-1">
          <SheetInput
            accessibilityLabel={intl.formatMessage({ id: "recipes.form.servings" })}
            className="text-lg font-semibold"
            inputMode="decimal"
            style={{ fontVariant: ["tabular-nums"] }}
            testID="recipe-servings-input"
            value={draft.servings}
            onChangeText={(text) => type("servings", text)}
          />
          {/* Laid over the field right after its digits, 16 pt padding plus 11 pt a digit. */}
          <Text
            className="text-muted absolute top-[17px] text-base"
            pointerEvents="none"
            style={{ left: 20 + Math.max(draft.servings.length, 1) * 11 }}
          >
            {intl.formatMessage({ id: "recipes.glanceBar.servings" }, { count: servings })}
          </Text>
        </TextField>
        <TextField className="w-[120px]">
          <SheetInput
            accessibilityLabel={intl.formatMessage({ id: "recipes.detail.multiplier" })}
            className="text-lg font-semibold"
            inputMode="decimal"
            prefix="×"
            testID="recipe-multiplier-input"
            value={draft.multiplier}
            onChangeText={(text) => type("multiplier", text)}
          />
        </TextField>
      </View>
      <View className="flex-row gap-2">
        {MULTIPLIERS.map((multiplier) => (
          <Pressable
            key={multiplier}
            accessibilityRole="button"
            accessibilityState={{ selected: picked === multiplier }}
            className={`h-10 flex-1 items-center justify-center rounded-full ${picked === multiplier ? "bg-accent" : "bg-sand"}`}
            testID={`recipe-multiplier-${multiplier}`}
            onPress={() => {
              setServings(original * multiplier);
              router.back();
            }}
          >
            <Text
              className={`text-sm font-medium ${picked === multiplier ? "text-accent-foreground" : "text-foreground"}`}
              style={picked === multiplier ? undefined : { color: foreground }}
            >
              {multiplier === 0.5 ? "½×" : `${multiplier}×`}
            </Text>
          </Pressable>
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
