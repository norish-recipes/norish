"use client";

import { useMemo, useState } from "react";
import { AnimatedNumber } from "@/components/recipes/animated-number";
import {
  BeakerIcon,
  BoltIcon,
  ChevronDownIcon,
  CubeIcon,
  FireIcon,
} from "@heroicons/react/16/solid";
import { Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ExtraNutrient, ExtraNutrients } from "@norish/shared/contracts/nutrients";
import type { MacroCalorieShare, MacroKey } from "@norish/shared/lib/nutrition-macros";
import { EXTRA_NUTRIENT_UNITS, knownExtras } from "@norish/shared/contracts/nutrients";
import { macroCalorieShares } from "@norish/shared/lib/nutrition-macros";

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
  protein: { color: "text-nutrition-protein", label: "protein", icon: BoltIcon },
};

/** The part of a macro a label lists beneath it: saturates under fat, sugars under carbs. */
const PART_OF: Partial<Record<MacroKey, "saturatedFat" | "sugars">> = {
  fat: "saturatedFat",
  carbs: "sugars",
};

/** The nutrients behind "More nutrients", in the order they are listed. */
const MORE_NUTRIENTS = ["fiber", "sodium"] as const satisfies ExtraNutrient[];

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
    },
    extras: Object.fromEntries(
      Object.entries(extras).map(([key, value]) => [key, value * portions])
    ) as ExtraNutrients,
  };
}

/** The asterisk after a value that may be higher, explained beneath the values. */
function Star({ testId }: { testId?: string }) {
  return (
    <span aria-hidden className="text-muted" data-testid={testId}>
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
          const offset = -drawn;

          drawn += length;

          return (
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
              strokeDashoffset={offset}
              strokeWidth="3.6"
            />
          );
        })}
      </svg>
      {calories != null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="flex items-start">
            <AnimatedNumber
              className="text-foreground text-2xl leading-none font-semibold"
              value={String(Math.round(calories))}
            />
            {marked ? <Star testId="nutrition-calories-mark" /> : null}
          </span>
          <span className="text-muted mt-1 text-xs">{t("calories")}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A recipe's nutrition values: a macro ring with the stored calories in its
 * centre and the macros as its legend, saturates and sugars beneath fat and
 * carbs as labels list them, and fiber and sodium behind "More nutrients".
 * A recipe with calories and no macros has no ring to draw, so its calories
 * are shown as a row of their own. `marked` puts an asterisk after the
 * calories of a worked-out total that left lines out; what it means is said
 * beneath, by the card.
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
  const [moreOpen, setMoreOpen] = useState(false);
  // The arcs read the stored macros, so the portion control moves the legend
  // and leaves the ring where it is.
  const shares = useMemo(() => macroCalorieShares(recipe), [recipe]);
  const { values, extras } = getNutritionData(recipe, portions);
  // A worked-out extra that not every counted line knew may be higher than it says.
  const partial = (key: ExtraNutrient) => (recipe.extrasCoverage?.[key] ?? 1) < 1;
  const more = MORE_NUTRIENTS.filter((key) => extras[key] !== undefined);
  const parts = shares.flatMap((macro) => PART_OF[macro.key] ?? []);
  // The card explains the asterisk when lines were left out; otherwise it is said here.
  const starNote =
    !marked && [...parts, ...more].some((key) => extras[key] !== undefined && partial(key));

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
          {marked ? <Star testId="nutrition-calories-mark" /> : null}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-5">
        <NutritionDonut calories={values.calories} marked={marked} shares={shares} />
        <dl className="divide-border min-w-0 flex-1 divide-y">
          {shares.map((macro) => {
            const style = MACRO_STYLES[macro.key];
            const value = values[macro.key];
            const part = PART_OF[macro.key];
            const partValue = part ? extras[part] : undefined;
            const withPart = part !== undefined && partValue !== undefined;

            return (
              <div key={macro.key} className={withPart ? "flex flex-col gap-1 py-2" : "py-2"}>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex min-w-0 items-center gap-2">
                    <style.icon className={`${style.color} size-4 shrink-0`} />
                    <span className="truncate text-base">{t(style.label)}</span>
                  </dt>
                  <dd className="text-foreground flex items-baseline text-base font-semibold">
                    <AnimatedNumber value={String(Math.round(value ?? macro.grams))} />
                    <span className="text-muted ml-1 font-normal">g</span>
                  </dd>
                </div>
                {withPart ? (
                  <div
                    className="text-muted flex items-center justify-between gap-2 pl-6 text-sm"
                    data-testid={`nutrition-${part}`}
                  >
                    <dt className="truncate">{t(part)}</dt>
                    <dd className="flex items-baseline">
                      <NutrientValue nutrient={part} partial={partial(part)} value={partValue} />
                    </dd>
                  </div>
                ) : null}
              </div>
            );
          })}
        </dl>
      </div>
      {more.length > 0 ? (
        <div className="border-border border-t">
          <button
            aria-expanded={moreOpen}
            className="text-muted hover:text-foreground flex min-h-11 w-full items-center justify-between text-sm transition-colors"
            data-testid="nutrition-more-toggle"
            type="button"
            onClick={() => setMoreOpen((wasOpen) => !wasOpen)}
          >
            <span>{t(moreOpen ? "fewerNutrients" : "moreNutrients")}</span>
            <ChevronDownIcon
              className={`size-4 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`}
            />
          </button>
          {moreOpen ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 pb-1" data-testid="nutrition-more">
              {more.map((key) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-2 text-sm"
                  data-testid={`nutrition-${key}`}
                >
                  <dt className="text-muted truncate">{t(key)}</dt>
                  <dd className="text-foreground flex items-baseline">
                    <NutrientValue nutrient={key} partial={partial(key)} value={extras[key]!} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
      {starNote ? (
        <p className="text-muted text-xs" data-testid="nutrition-star-note">
          * {t("starredMayBeHigher")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One of the other nutrients in its own unit, starred where it may be higher.
 * A value that may be higher and rounds to nothing says nothing: "—", not "0".
 */
function NutrientValue({
  nutrient,
  value,
  partial,
}: {
  nutrient: ExtraNutrient;
  value: number;
  partial: boolean;
}) {
  const unit = EXTRA_NUTRIENT_UNITS[nutrient];
  // Grams to a tenth, as labels give them; milligrams and micrograms whole.
  const shown = unit === "g" ? Math.round(value * 10) / 10 : Math.round(value);

  if (partial && shown === 0) return <span data-testid="nutrition-unknown">—</span>;

  return (
    <>
      <AnimatedNumber value={String(shown)} />
      {partial ? <Star testId="nutrition-partial" /> : null}
      <span className="text-muted ml-1">{unit}</span>
    </>
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
