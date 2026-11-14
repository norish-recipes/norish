import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Chip, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useLoadedPageRecipe,
  usePageEnrichment,
  useRatingQuery,
  useRatingsMutation,
  useRecipeCookbooksQuery,
  useWorkedOutNutrition,
} from "@norish/shared-react/recipes";
import { macroCalorieShares } from "@norish/shared/lib/nutrition-macros";
import { hasSubstantiveProvenance } from "@norish/shared/lib/recipe-enrichment";
import { countryEndonym, countryFlagEmoji } from "@norish/shared/lib/recipe-provenance";

import { useTokenColor } from "../hooks/use-token-color";
import { plainText } from "../utils/recipe-rows";
import { SectionCard, useTint } from "./tint";

export function NotesSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const { showNotes } = useHiddenItemVisibility();

  if (!recipe.notes || !showNotes) return null;

  return (
    <SectionCard testID="recipe-notes" title={intl.formatMessage({ id: "recipes.detail.notes" })}>
      <Text className="text-foreground text-base leading-6">{plainText(recipe.notes)}</Text>
    </SectionCard>
  );
}

/** Five stars; the star that is already yours clears the rating. */
export function RatingSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const { showRatings } = useHiddenItemVisibility();
  const { userRating, averageRating } = useRatingQuery(recipe.id);
  const { rateRecipe } = useRatingsMutation();
  const [star, muted] = useThemeColor(["warning", "muted"] as const);
  const shown = Math.round(userRating ?? averageRating ?? 0);

  if (!showRatings) return null;

  return (
    <SectionCard testID="recipe-rating">
      <View className="items-center gap-3 pt-3.5 pb-1">
        <Text className="text-muted text-base font-medium">
          {intl.formatMessage({ id: "recipes.detail.ratingPrompt" })}
        </Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityLabel={intl.formatMessage(
                { id: "recipes.detail.rateStars" },
                { count: value }
              )}
              accessibilityRole="radio"
              accessibilityState={{ checked: userRating === value }}
              hitSlop={4}
              testID={`recipe-rate-${value}`}
              onPress={() => rateRecipe(recipe.id, userRating === value ? null : value)}
            >
              <Ionicons
                color={value <= shown ? star : muted}
                name={value <= shown ? "star" : "star-outline"}
                size={34}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </SectionCard>
  );
}

/** The cookbooks the recipe is in, as chips that open them; Manage files it into more. */
export function CookbooksSection() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const { showCookbooks } = useHiddenItemVisibility();
  const { cookbooks } = useRecipeCookbooksQuery(showCookbooks ? recipe.id : null);
  const tint = useTint();

  if (!showCookbooks || cookbooks.length === 0) return null;

  return (
    <SectionCard
      right={
        <Pressable
          accessibilityRole="button"
          className="bg-default h-9 flex-row items-center gap-1.5 rounded-full px-3.5"
          style={tint ? { backgroundColor: tint.soft } : undefined}
          testID="recipe-manage-cookbooks"
          onPress={() =>
            router.push({
              pathname: "/add-to-cookbook",
              params: { recipeId: recipe.id, name: recipe.name },
            })
          }
        >
          <Ionicons color="currentColor" name="book-outline" size={16} />
          <Text className="text-foreground text-sm font-medium">
            {intl.formatMessage({ id: "recipes.cookbooks.manage" })}
          </Text>
        </Pressable>
      }
      testID="recipe-cookbooks"
      title={intl.formatMessage({ id: "recipes.cookbooks.cardTitle" })}
    >
      <View className="flex-row flex-wrap gap-2">
        {cookbooks.map((cookbook) => (
          <Pressable
            key={cookbook.id}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/cookbook/[id]", params: { id: cookbook.id } })}
          >
            <Chip size="lg" variant="secondary">
              <Chip.Label>{cookbook.title}</Chip.Label>
            </Chip>
          </Pressable>
        ))}
      </View>
    </SectionCard>
  );
}

const MACRO_ICON = {
  fat: "water-outline",
  carbs: "cube-outline",
  protein: "flash-outline",
} as const;

type Shown = {
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
};

const asNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "string" ? parseFloat(value) : value;

  return parsed == null || Number.isNaN(parsed) ? null : parsed;
};

/** The recipe's stored nutrition as numbers; null when it stores none. */
export function storedNutrition(
  recipe: Pick<FullRecipeDTO, "calories" | "fat" | "carbs" | "protein">
): Shown | null {
  const shown = {
    calories: asNumber(recipe.calories),
    fat: asNumber(recipe.fat),
    carbs: asNumber(recipe.carbs),
    protein: asNumber(recipe.protein),
  };

  return Object.values(shown).some((value) => value !== null) ? shown : null;
}

function Donut({ shown, portions }: { shown: Shown; portions: number }) {
  const intl = useIntl();
  const colors = {
    fat: useTokenColor("nutrition-fat"),
    carbs: useTokenColor("nutrition-carbs"),
    protein: useTokenColor("nutrition-protein"),
  };
  const shares = macroCalorieShares(shown).map((macro, index, all) => ({
    ...macro,
    offset: -all.slice(0, index).reduce((sum, before) => sum + before.share * 100, 0),
  }));

  return (
    <View className="size-32 items-center justify-center">
      <Svg
        height={128}
        style={{ transform: [{ rotate: "-90deg" }] }}
        viewBox="0 0 36 36"
        width={128}
      >
        {shares.map((macro) => (
          <Circle
            key={macro.key}
            cx="18"
            cy="18"
            fill="none"
            r="15.9155"
            stroke={colors[macro.key]}
            strokeDasharray={`${macro.share * 100} ${100 - macro.share * 100}`}
            strokeDashoffset={macro.offset}
            strokeWidth="3.6"
          />
        ))}
      </Svg>
      {shown.calories != null ? (
        <View className="absolute items-center">
          <Text className="text-foreground text-2xl font-semibold">
            {String(Math.round(shown.calories * portions))}
          </Text>
          <Text className="text-muted text-xs">
            {intl.formatMessage({ id: "recipes.nutrition.calories" })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Nutrition: stored values, else the total worked out from the lines; portions scale it. */
export function NutritionSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const enrichment = usePageEnrichment();
  const { showNutrition } = useHiddenItemVisibility();
  const workedOut = useWorkedOutNutrition(recipe);
  const [portions, setPortions] = useState(1);
  const [listOpen, setListOpen] = useState(false);
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const macroColor = {
    fat: useTokenColor("nutrition-fat"),
    carbs: useTokenColor("nutrition-carbs"),
    protein: useTokenColor("nutrition-protein"),
  };
  const tint = useTint();
  const stored = storedNutrition(recipe);
  const perServing = workedOut?.perServing;
  const shown: Shown | null =
    stored ??
    (perServing
      ? {
          calories: perServing.calories,
          fat: perServing.fat,
          carbs: perServing.carbs,
          protein: perServing.protein,
        }
      : null);
  const estimating = enrichment.isBusy("nutrition-estimation");

  if (!showNutrition || (!shown && !estimating)) return null;

  const shares = shown ? macroCalorieShares(shown) : [];
  const leftOut = !stored ? (workedOut?.leftOut ?? []) : [];
  const step = (next: number) => setPortions(Math.max(1, portions + next));

  return (
    <SectionCard
      right={
        shown && !estimating ? (
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityLabel={intl.formatMessage({ id: "recipes.nutrition.decreasePortions" })}
              accessibilityRole="button"
              className="bg-default size-9 items-center justify-center rounded-full"
              style={tint ? { backgroundColor: tint.soft } : undefined}
              onPress={() => step(-1)}
            >
              <Ionicons color={foreground} name="remove" size={17} />
            </Pressable>
            <Text className="text-foreground min-w-14 text-center text-sm font-semibold">
              {intl.formatMessage({ id: "recipes.nutrition.portions" }, { count: portions })}
            </Text>
            <Pressable
              accessibilityLabel={intl.formatMessage({ id: "recipes.nutrition.increasePortions" })}
              accessibilityRole="button"
              className="bg-default size-9 items-center justify-center rounded-full"
              style={tint ? { backgroundColor: tint.soft } : undefined}
              onPress={() => step(1)}
            >
              <Ionicons color={foreground} name="add" size={17} />
            </Pressable>
          </View>
        ) : null
      }
      testID="recipe-nutrition"
      title={intl.formatMessage({ id: "recipes.nutrition.title" })}
    >
      {estimating || !shown ? (
        <Text className="text-muted py-6 text-center text-sm">
          {intl.formatMessage({ id: "recipes.actions.estimatingNutrition" })}
        </Text>
      ) : (
        <>
          <View className="flex-row items-center gap-5 pt-1">
            {shares.length > 0 ? <Donut portions={portions} shown={shown} /> : null}
            <View className="min-w-0 flex-1">
              {shares.length === 0 && shown.calories != null ? (
                <Text className="text-foreground text-base font-semibold">
                  {`${Math.round(shown.calories * portions)} kcal`}
                </Text>
              ) : null}
              {shares.map((macro) => (
                <View
                  key={macro.key}
                  className="border-separator flex-row items-center justify-between gap-2 border-b py-2"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      color={macroColor[macro.key]}
                      name={MACRO_ICON[macro.key]}
                      size={16}
                    />
                    <Text className="text-foreground text-base">
                      {intl.formatMessage({ id: `recipes.nutrition.${macro.key}` })}
                    </Text>
                  </View>
                  <Text className="text-foreground text-base font-semibold">
                    {`${Math.round((shown[macro.key] ?? macro.grams) * portions)} `}
                    <Text className="text-muted font-normal">g</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {!stored && workedOut?.estimated ? (
            <Text className="text-muted pt-2 text-xs">
              {intl.formatMessage({ id: "recipes.nutrition.estimated" })}
            </Text>
          ) : null}
          {leftOut.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: listOpen }}
              className="flex-row items-center gap-1 pt-3"
              onPress={() => setListOpen(!listOpen)}
            >
              <Ionicons
                color={muted}
                name={listOpen ? "chevron-down" : "chevron-forward"}
                size={14}
              />
              <Text className="text-muted text-sm">
                {intl.formatMessage({ id: "recipes.nutrition.leftOut" }, { count: leftOut.length })}
              </Text>
            </Pressable>
          ) : null}
          {listOpen
            ? leftOut.map(({ lineId, name, reason, estimatedByAI }) => (
                <View key={lineId} className="flex-row flex-wrap items-baseline gap-x-2 pt-1">
                  <Text className="text-foreground text-sm">{plainText(name)}</Text>
                  <Text className="text-muted text-xs">
                    {estimatedByAI
                      ? intl.formatMessage({ id: "recipes.nutrition.estimatedByAI" })
                      : intl.formatMessage({
                          id: `recipes.nutrition.reasons.${REASON_KEYS[reason]}`,
                        })}
                  </Text>
                </View>
              ))
            : null}
        </>
      )}
    </SectionCard>
  );
}

const REASON_KEYS = {
  seasoning: "seasoning",
  "no-amount": "noAmount",
  "no-size": "noSize",
  "no-numbers": "noNumbers",
  "no-spoon-weight": "noSpoonWeight",
  "no-piece-weight": "noPieceWeight",
} as const;

/** Where the dish comes from: country, region, cuisines and a note. */
export function ProvenanceSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const enrichment = usePageEnrichment();
  const { showProvenance } = useHiddenItemVisibility();
  const inferring = enrichment.isBusy("recipe-provenance");

  if (!showProvenance || (!hasSubstantiveProvenance(recipe) && !inferring)) return null;

  const flag = countryFlagEmoji(recipe.originCountry);
  const country = inferring
    ? null
    : (recipe.originCountryName ?? countryEndonym(recipe.originCountry, intl.locale));
  const title = `${flag ? `${flag} ` : ""}${country ?? intl.formatMessage({ id: "recipes.provenance.title" })}`;

  return (
    <SectionCard testID="recipe-provenance" title={title}>
      {inferring ? (
        <Text className="text-muted pb-2 text-sm">
          {intl.formatMessage({ id: "recipes.actions.inferringProvenance" })}
        </Text>
      ) : (
        <View className="gap-3">
          {recipe.originRegion ? (
            <View className="flex-row items-baseline gap-2">
              <Text className="text-muted text-sm">
                {intl.formatMessage({ id: "recipes.provenance.region" })}
              </Text>
              <Text className="text-foreground text-base">{recipe.originRegion}</Text>
            </View>
          ) : null}
          {recipe.cuisines.length > 0 ? (
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-muted text-sm">
                {intl.formatMessage({ id: "recipes.provenance.cuisines" })}
              </Text>
              {recipe.cuisines.map((cuisine) => (
                <Chip key={cuisine.id} size="sm" variant="secondary">
                  <Chip.Label>{cuisine.name}</Chip.Label>
                </Chip>
              ))}
            </View>
          ) : null}
          {recipe.provenanceNote ? (
            <Text className="text-foreground text-base leading-6">{recipe.provenanceNote}</Text>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** The page the recipe came from, and who added it. */
export function SourceSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const [muted] = useThemeColor(["muted"] as const);
  const accent = useTokenColor("accent-text");
  const author = recipe.author?.name ?? null;

  if (!recipe.url && !author) return null;

  return (
    <SectionCard testID="recipe-source" title={intl.formatMessage({ id: "recipes.detail.source" })}>
      {recipe.url ? (
        <Pressable
          accessibilityHint={intl.formatMessage({ id: "recipes.detail.viewOriginal" })}
          accessibilityRole="link"
          className="flex-row items-center gap-3 py-2.5"
          onPress={() => void Linking.openURL(recipe.url!)}
        >
          <View className="bg-accent/10 size-8 items-center justify-center rounded-xl">
            <Ionicons color={accent} name="globe-outline" size={16} />
          </View>
          <Text className="text-foreground min-w-0 flex-1 text-base" numberOfLines={1}>
            {hostOf(recipe.url)}
          </Text>
          <Ionicons color={muted} name="open-outline" size={16} />
        </Pressable>
      ) : null}
      {author ? (
        <View className="border-separator flex-row items-center gap-3 border-t py-2.5">
          <View className="bg-avatar size-8 items-center justify-center rounded-full">
            <Text className="text-foreground text-sm font-semibold">
              {author.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text className="text-muted min-w-0 flex-1 text-base" numberOfLines={1}>
            {intl.formatMessage({ id: "recipes.detail.addedBy" }, { name: author })}
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}
