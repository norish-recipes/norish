import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useRouter } from "expo-router";
import { Input, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import {
  MIN_SERVINGS,
  useLoadedPageRecipe,
  usePageServings,
  useRecipePageStore,
} from "@norish/shared-react/recipes";
import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

const MULTIPLIERS = [0.5, 1, 2, 3, 4];

/** The Servings sheet: type the servings or a multiplier, or pick one; each change scales the page. */
export function RecipeServingsScreen() {
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
    <Sheet name="recipe-servings" title={intl.formatMessage({ id: "recipes.form.servings" })}>
      <SheetBody contentClassName="gap-3">
        <View className="flex-row gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            <TextField className="flex-1">
              <Input
                accessibilityLabel={intl.formatMessage({ id: "recipes.form.servings" })}
                inputMode="decimal"
                testID="recipe-servings-input"
                value={draft.servings}
                onChangeText={(text) => type("servings", text)}
              />
            </TextField>
            <Text className="text-muted text-sm">
              {intl.formatMessage({ id: "recipes.glanceBar.servings" }, { count: servings })}
            </Text>
          </View>
          <View className="w-28 flex-row items-center gap-2">
            <Text className="text-muted text-base">×</Text>
            <TextField className="flex-1">
              <Input
                accessibilityLabel={intl.formatMessage({ id: "recipes.detail.multiplier" })}
                inputMode="decimal"
                testID="recipe-multiplier-input"
                value={draft.multiplier}
                onChangeText={(text) => type("multiplier", text)}
              />
            </TextField>
          </View>
        </View>
        <View className="flex-row gap-2">
          {MULTIPLIERS.map((multiplier) => (
            <Pressable
              key={multiplier}
              accessibilityRole="button"
              accessibilityState={{ selected: picked === multiplier }}
              className={`h-10 flex-1 items-center justify-center rounded-full ${picked === multiplier ? "bg-accent" : "bg-default"}`}
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
    </Sheet>
  );
}
