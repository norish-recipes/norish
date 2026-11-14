import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { useActiveAllergies, useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  formatServings,
  recipeCardFacts,
  usePageServings,
  useWorkedOutNutrition,
} from "@norish/shared-react/recipes";
import { isBuiltInCategory } from "@norish/shared/lib/categories";
import { reconcileCookingTime } from "@norish/shared/lib/cooking-time";
import { isAllergenTag } from "@norish/shared/lib/helpers";
import { countryFlagEmoji } from "@norish/shared/lib/recipe-provenance";

import { plainText } from "../utils/recipe-rows";
import { useTint } from "./tint";

function Description({ text }: { text: string }) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);

  return (
    <View className="items-center gap-1">
      <Text
        className="text-muted text-center text-base leading-[23px]"
        numberOfLines={open ? undefined : 4}
        onTextLayout={(event) => {
          if (!open) setClamped(event.nativeEvent.lines.length > 4);
        }}
      >
        {plainText(text)}
      </Text>
      {clamped || open ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen(!open)}>
          <Text className="text-muted text-xs font-medium">
            {intl.formatMessage({
              id: open ? "recipes.detail.showLess" : "recipes.detail.showMore",
            })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Fact({ icon, children, color }: { icon: string; children: string; color?: string }) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View className="flex-1 flex-row items-center justify-center gap-[7px]">
      <Ionicons color={color ?? muted} name={icon as "time-outline"} size={18} />
      <Text className="text-foreground text-base font-semibold tabular-nums">{children}</Text>
    </View>
  );
}

/** The time bar under the glance bar: preparation and cooking as two bars of their own hue. */
function TimeBar({ recipe }: { recipe: FullRecipeDTO }) {
  const intl = useIntl();
  const prep = useTokenColor("cooking-prep");
  const cook = useTokenColor("cooking-cook");
  const breakdown = reconcileCookingTime(recipe);
  const parts = breakdown?.segments.filter(({ kind }) => kind === "prep" || kind === "cook") ?? [];

  if (parts.length === 0) return null;

  return (
    <View className="gap-1.5 self-stretch px-1.5">
      <View className="h-1.5 flex-row gap-[3px]">
        {parts.map(({ kind, share }) => (
          <View
            key={kind}
            className="rounded-[3px]"
            style={{ flex: share, backgroundColor: kind === "prep" ? prep : cook }}
          />
        ))}
      </View>
      <View className="flex-row justify-between">
        {parts.map(({ kind, minutes }) => (
          <Text key={kind} className="text-muted text-[13px]">
            {`${intl.formatMessage({ id: `recipes.cookingTime.${kind}` })} ${minutes}m`}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** The title block: name, description, glance bar, time bar and tags, on the page ground. */
export function RecipeHeader({ recipe }: { recipe: FullRecipeDTO }) {
  const intl = useIntl();
  const servings = usePageServings();
  const { allergies } = useActiveAllergies();
  const { showNutrition } = useHiddenItemVisibility();
  const workedOut = useWorkedOutNutrition(recipe);
  const tint = useTint();
  const calories = useTokenColor("nutrition-calories");
  const facts = recipeCardFacts(recipe, allergies);
  const flag = countryFlagEmoji(recipe.originCountry);
  const kcal = recipe.calories ?? workedOut?.perServing?.calories ?? null;
  const categories = recipe.categories.map((name) =>
    isBuiltInCategory(name)
      ? intl.formatMessage({ id: `recipes.form.category.${name.toLowerCase()}` })
      : name
  );
  const plainTags = facts.tagNames.filter((tag) => !isAllergenTag(tag, facts.allergySet));
  const allergens = facts.tagNames.filter((tag) => isAllergenTag(tag, facts.allergySet));
  const shown = [...categories, ...plainTags].join(", ");

  return (
    <View className="items-center gap-3.5 px-5 pt-1">
      <Text
        accessibilityRole="header"
        className="text-foreground text-center text-[32px] leading-[38px] font-semibold tracking-[-0.7px]"
        testID="recipe-name"
      >
        {flag ? `${flag} ` : ""}
        {recipe.name}
      </Text>
      {recipe.description ? <Description text={recipe.description} /> : null}
      <View
        className="bg-surface mt-1 h-[52px] flex-row items-center self-stretch rounded-full"
        style={tint ? { backgroundColor: tint.card } : undefined}
        testID="recipe-glance"
      >
        {recipe.totalMinutes || facts.timeLabel ? (
          <Fact icon="time-outline">{facts.timeLabel ?? ""}</Fact>
        ) : null}
        {recipe.servings ? <Fact icon="people-outline">{formatServings(servings)}</Fact> : null}
        {showNutrition && kcal != null ? (
          <Fact color={calories} icon="flame-outline">
            {String(Math.round(kcal))}
          </Fact>
        ) : null}
      </View>
      <TimeBar recipe={recipe} />
      {allergens.length > 0 || shown ? (
        <Text className="text-muted text-center text-sm leading-5" testID="recipe-tags">
          {allergens.map((tag) => (
            <Text key={tag} className="text-warning-foreground bg-warning font-medium">
              {` ${tag} `}
            </Text>
          ))}
          {allergens.length > 0 && shown ? "  " : ""}
          {shown}
        </Text>
      ) : null}
    </View>
  );
}
