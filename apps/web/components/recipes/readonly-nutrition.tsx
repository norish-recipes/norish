"use client";

import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/recipes/animated-number";
import { BeakerIcon, BoltIcon, CubeIcon, FireIcon } from "@heroicons/react/16/solid";
import { Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { MacroCalorieShare, MacroKey } from "@norish/shared/lib/nutrition-macros";
import { macroCalorieShares } from "@norish/shared/lib/nutrition-macros";

import NutritionPortionControl from "./nutrition-portion-control";

export type NutritionRecipeLike = {
  calories: number | null;
  fat: number | string | null;
  carbs: number | string | null;
  protein: number | string | null;
};

const MACRO_STYLES: Record<MacroKey, { color: string; label: string; icon: typeof BeakerIcon }> = {
  fat: { color: "text-nutrition-fat", label: "fat", icon: BeakerIcon },
  carbs: { color: "text-nutrition-carbs", label: "carbs", icon: CubeIcon },
  protein: { color: "text-nutrition-protein", label: "protein", icon: BoltIcon },
};

export function getNutritionData(recipe: NutritionRecipeLike, portions: number) {
  const parsedFat = typeof recipe.fat === "string" ? parseFloat(recipe.fat) : recipe.fat;
  const parsedCarbs = typeof recipe.carbs === "string" ? parseFloat(recipe.carbs) : recipe.carbs;
  const parsedProtein =
    typeof recipe.protein === "string" ? parseFloat(recipe.protein) : recipe.protein;

  return {
    hasData:
      recipe.calories != null || parsedFat != null || parsedCarbs != null || parsedProtein != null,
    values: {
      calories: recipe.calories != null ? recipe.calories * portions : null,
      fat: parsedFat != null ? parsedFat * portions : null,
      carbs: parsedCarbs != null ? parsedCarbs * portions : null,
      protein: parsedProtein != null ? parsedProtein * portions : null,
    },
  };
}

/** The asterisk after the calories of a total that left lines out, explained beneath it. */
function CaloriesMark() {
  return (
    <span aria-hidden className="text-muted" data-testid="nutrition-calories-mark">
      *
    </span>
  );
}

/**
 * The macro ring: one arc per stored macro, sized by the calories it
 * contributes rather than by its weight in grams. The recipe's own stored
 * calories sit in the centre — the arcs and that figure may disagree, and
 * where they do the stored figure wins, because a calorie count computed
 * from macros is not a number anybody supplied.
 */
function NutritionDonut({
  shares,
  calories,
  marked,
}: {
  shares: MacroCalorieShare[];
  calories: number | null;
  marked: boolean;
}) {
  const t = useTranslations("recipes.nutrition");
  let drawn = 0;

  return (
    <div className="relative size-32 shrink-0">
      <svg aria-hidden className="size-full -rotate-90" viewBox="0 0 36 36">
        {shares.map((macro) => {
          const length = macro.share * 100;
          const arc = (
            <circle
              key={macro.key}
              className={MACRO_STYLES[macro.key].color}
              cx="18"
              cy="18"
              fill="none"
              pathLength={100}
              r="15.9155"
              stroke="currentColor"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-drawn}
              strokeWidth="3.6"
            />
          );

          drawn += length;

          return arc;
        })}
      </svg>
      {calories != null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="flex items-start">
            <AnimatedNumber
              className="text-foreground text-2xl leading-none font-semibold"
              value={String(Math.round(calories))}
            />
            {marked ? <CaloriesMark /> : null}
          </span>
          <span className="text-muted mt-1 text-xs">{t("calories")}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A recipe's nutrition values: a macro ring with the stored calories in its
 * centre and the macros as its legend. A recipe with calories and no macros
 * has no ring to draw, so its calories are shown as a row of their own.
 * `marked` puts an asterisk after the calories of a worked-out total that
 * left lines out; what it means is said beneath.
 */
export function NutritionBody({
  recipe,
  portions,
  marked = false,
}: {
  recipe: NutritionRecipeLike;
  portions: number;
  marked?: boolean;
}) {
  const t = useTranslations("recipes.nutrition");
  // The arcs read the stored macros, so the portion control moves the legend
  // and leaves the ring where it is.
  const shares = useMemo(() => macroCalorieShares(recipe), [recipe]);
  const values = getNutritionData(recipe, portions).values;

  if (shares.length === 0) {
    if (values.calories == null) return null;

    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="bg-nutrition-calories-soft flex size-8 items-center justify-center rounded-full">
            <FireIcon className="text-nutrition-calories size-4" />
          </div>
          <span className="text-base">{t("calories")}</span>
        </div>
        <span className="text-foreground flex items-baseline text-base font-semibold">
          <AnimatedNumber value={String(Math.round(values.calories))} />
          <span className="text-muted ml-1 font-normal">kcal</span>
          {marked ? <CaloriesMark /> : null}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <NutritionDonut calories={values.calories} marked={marked} shares={shares} />
      <dl className="divide-border min-w-0 flex-1 divide-y">
        {shares.map((macro) => {
          const style = MACRO_STYLES[macro.key];
          const value = values[macro.key];

          return (
            <div key={macro.key} className="flex items-center justify-between gap-2 py-2">
              <dt className="flex min-w-0 items-center gap-2">
                <style.icon className={`${style.color} size-4 shrink-0`} />
                <span className="truncate text-base">{t(style.label)}</span>
              </dt>
              <dd className="text-foreground flex items-baseline text-base font-semibold">
                <AnimatedNumber value={String(Math.round(value ?? macro.grams))} />
                <span className="text-muted ml-1 font-normal">g</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function NutritionValues({
  inCard = true,
  recipe,
}: {
  inCard?: boolean;
  recipe: NutritionRecipeLike;
}) {
  const t = useTranslations("recipes.nutrition");
  const [portions, setPortions] = useState(1);
  const nutritionData = useMemo(() => getNutritionData(recipe, portions), [recipe, portions]);

  if (!nutritionData.hasData) {
    return null;
  }

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <NutritionPortionControl portions={portions} onChange={setPortions} />
      </div>
      <NutritionBody portions={portions} recipe={recipe} />
      {portions !== 1 && (
        <p className="text-muted mt-2 text-center text-xs">
          {t("showingPortions", { count: portions })}
        </p>
      )}
    </>
  );

  return inCard ? (
    <Card className="rounded-2xl">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  ) : (
    <>
      <Separator />
      <div className="space-y-2">{content}</div>
    </>
  );
}

export function ReadonlyNutritionCard({ recipe }: { recipe: NutritionRecipeLike }) {
  return <NutritionValues recipe={recipe} />;
}

export function ReadonlyNutritionSection({ recipe }: { recipe: NutritionRecipeLike }) {
  return <NutritionValues inCard={false} recipe={recipe} />;
}
