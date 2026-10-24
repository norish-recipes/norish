"use client";

import { Fragment, useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/recipes/animated-number";
import { BeakerIcon, BoltIcon, CubeIcon, FireIcon, SwatchIcon } from "@heroicons/react/16/solid";
import { Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ExtraNutrient, ExtraNutrients } from "@norish/shared/contracts/nutrients";
import type { MacroCalorieShare, MacroKey } from "@norish/shared/lib/nutrition-macros";
import { EXTRA_NUTRIENT_UNITS, knownExtras } from "@norish/shared/contracts/nutrients";
import { CALORIES_PER_GRAM, macroCalorieShares } from "@norish/shared/lib/nutrition-macros";

import NutritionPortionControl from "./nutrition-portion-control";

export type NutritionRecipeLike = {
  calories: number | null;
  fat: number | string | null;
  carbs: number | string | null;
  protein: number | string | null;
  /** The other nutrients per serving, only those known. */
  nutritionExtras?: ExtraNutrients | null;
  /** For a worked-out extra, the share of the counted lines' weight whose food knew it. */
  extrasCoverage?: Partial<Record<ExtraNutrient, number>>;
};

const MACRO_STYLES: Record<MacroKey, { color: string; label: string; icon: typeof BeakerIcon }> = {
  fat: { color: "text-nutrition-fat", label: "fat", icon: BeakerIcon },
  carbs: { color: "text-nutrition-carbs", label: "carbs", icon: CubeIcon },
  fiber: { color: "text-nutrition-fiber", label: "fiber", icon: SwatchIcon },
  protein: { color: "text-nutrition-protein", label: "protein", icon: BoltIcon },
};

/** The part of a macro a label lists beneath it: saturates under fat, sugars under carbs. */
const PART_OF: Partial<Record<MacroKey, "saturatedFat" | "sugars">> = {
  fat: "saturatedFat",
  carbs: "sugars",
};

export function getNutritionData(recipe: NutritionRecipeLike, portions: number) {
  const parsedFat = typeof recipe.fat === "string" ? parseFloat(recipe.fat) : recipe.fat;
  const parsedCarbs = typeof recipe.carbs === "string" ? parseFloat(recipe.carbs) : recipe.carbs;
  const parsedProtein =
    typeof recipe.protein === "string" ? parseFloat(recipe.protein) : recipe.protein;

  const extras = knownExtras(recipe.nutritionExtras);

  return {
    hasData:
      recipe.calories != null || parsedFat != null || parsedCarbs != null || parsedProtein != null,
    values: {
      calories: recipe.calories != null ? recipe.calories * portions : null,
      fat: parsedFat != null ? parsedFat * portions : null,
      carbs: parsedCarbs != null ? parsedCarbs * portions : null,
      protein: parsedProtein != null ? parsedProtein * portions : null,
      fiber: extras.fiber != null ? extras.fiber * portions : null,
    },
    extras: Object.fromEntries(
      Object.entries(extras).map(([key, value]) => [key, value * portions])
    ) as ExtraNutrients,
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
 * contributes rather than by its weight in grams, with the sugars a lighter
 * band at the start of the carbohydrate arc. The recipe's own stored
 * calories sit in the centre — the arcs and that figure may disagree, and
 * where they do the stored figure wins, because a calorie count computed
 * from macros is not a number anybody supplied.
 */
function NutritionDonut({
  shares,
  sugars,
  calories,
  marked,
}: {
  shares: MacroCalorieShare[];
  sugars: number | null;
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

          const sugarCalories =
            macro.key === "carbs" && sugars ? sugars * CALORIES_PER_GRAM.carbs : 0;
          const sugarLength =
            macro.calories > 0 ? length * Math.min(sugarCalories / macro.calories, 1) : 0;
          const band =
            sugarLength > 0 ? (
              <circle
                key="sugars"
                className="text-background"
                cx="18"
                cy="18"
                data-testid="nutrition-sugars-band"
                fill="none"
                opacity={0.4}
                pathLength={100}
                r="15.9155"
                stroke="currentColor"
                strokeDasharray={`${sugarLength} ${100 - sugarLength}`}
                strokeDashoffset={-drawn}
                strokeWidth="3.6"
              />
            ) : null;

          drawn += length;

          return [arc, band];
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
  const shares = useMemo(
    () => macroCalorieShares({ ...recipe, fiber: knownExtras(recipe.nutritionExtras).fiber }),
    [recipe]
  );
  const { values, extras } = getNutritionData(recipe, portions);
  const perServing = knownExtras(recipe.nutritionExtras);
  // A worked-out extra that not every counted line knew is at least what it says.
  const atLeast = (key: ExtraNutrient) => (recipe.extrasCoverage?.[key] ?? 1) < 1;

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
      <NutritionDonut
        calories={values.calories}
        marked={marked}
        shares={shares}
        sugars={perServing.sugars ?? null}
      />
      <dl className="divide-border min-w-0 flex-1 divide-y">
        {shares.map((macro) => {
          const style = MACRO_STYLES[macro.key];
          const value = values[macro.key];
          const part = PART_OF[macro.key];
          const partValue = part ? extras[part] : undefined;

          const withPart = part !== undefined && partValue !== undefined;

          return (
            <Fragment key={macro.key}>
              <div
                className={`flex items-center justify-between gap-2 ${withPart ? "border-b-0 pt-2" : "py-2"}`}
              >
                <dt className="flex min-w-0 items-center gap-2">
                  <style.icon className={`${style.color} size-4 shrink-0`} />
                  <span className="truncate text-base">{t(style.label)}</span>
                </dt>
                <dd className="text-foreground flex items-baseline text-base font-semibold">
                  {macro.key === "fiber" && atLeast("fiber") ? <AtLeast /> : null}
                  <AnimatedNumber value={String(Math.round(value ?? macro.grams))} />
                  <span className="text-muted ml-1 font-normal">g</span>
                </dd>
              </div>
              {withPart ? (
                <ExtraRow
                  atLeast={atLeast(part)}
                  label={t(part)}
                  nutrient={part}
                  testId={`nutrition-${part}`}
                  value={partValue}
                />
              ) : null}
            </Fragment>
          );
        })}
        {extras.sodium !== undefined ? (
          <ExtraRow
            prominent
            atLeast={atLeast("sodium")}
            label={t("sodium")}
            nutrient="sodium"
            testId="nutrition-sodium"
            value={extras.sodium}
          />
        ) : null}
      </dl>
    </div>
  );
}

/** The mark before a value that is a lower bound: not every counted line's food knew it. */
function AtLeast() {
  return (
    <span className="text-muted mr-0.5 font-normal" data-testid="nutrition-at-least">
      ≥
    </span>
  );
}

/** A nutrient listed beneath a macro, or on its own row, in its own unit. */
function ExtraRow({
  label,
  nutrient,
  value,
  atLeast,
  prominent = false,
  testId,
}: {
  label: string;
  nutrient: ExtraNutrient;
  value: number;
  atLeast: boolean;
  prominent?: boolean;
  testId: string;
}) {
  const unit = EXTRA_NUTRIENT_UNITS[nutrient];
  // Grams to a tenth, as labels give them; milligrams and micrograms whole.
  const shown = unit === "g" ? Math.round(value * 10) / 10 : Math.round(value);

  return (
    <div
      className={`flex items-center justify-between gap-2 ${prominent ? "py-2 text-base" : "text-muted pb-2 pl-6 text-sm"}`}
      data-testid={testId}
    >
      <dt className="truncate">{label}</dt>
      <dd className={`flex items-baseline ${prominent ? "text-foreground font-semibold" : ""}`}>
        {atLeast ? <AtLeast /> : null}
        <AnimatedNumber value={String(shown)} />
        <span className="text-muted ml-1 font-normal">{unit}</span>
      </dd>
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
