"use client";

import { useMemo, useState } from "react";
import { BeakerIcon, BoltIcon, CubeIcon, FireIcon } from "@heroicons/react/16/solid";
import { Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import NutritionPortionControl from "./nutrition-portion-control";

export type NutritionRecipeLike = {
  calories: number | null;
  fat: number | string | null;
  carbs: number | string | null;
  protein: number | string | null;
};

export const MACROS = [
  {
    key: "calories",
    labelKey: "calories",
    unit: "kcal",
    icon: FireIcon,
    color: "text-nutrition-calories",
    bg: "bg-nutrition-calories-soft",
  },
  {
    key: "fat",
    labelKey: "fat",
    unit: "g",
    icon: BeakerIcon,
    color: "text-nutrition-fat",
    bg: "bg-nutrition-fat-soft",
  },
  {
    key: "carbs",
    labelKey: "carbs",
    unit: "g",
    icon: CubeIcon,
    color: "text-nutrition-carbs",
    bg: "bg-nutrition-carbs-soft",
  },
  {
    key: "protein",
    labelKey: "protein",
    unit: "g",
    icon: BoltIcon,
    color: "text-nutrition-protein",
    bg: "bg-nutrition-protein-soft",
  },
] as const;

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
      <div className="divide-border divide-y">
        {MACROS.map(({ key, labelKey, unit, icon: Icon, color, bg }) => {
          const value = nutritionData.values[key];

          if (value == null) return null;

          return (
            <div key={key} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <span className="text-base">{t(labelKey)}</span>
              </div>
              <span className="text-foreground text-base font-semibold">
                {Math.round(value)}
                <span className="text-muted ml-1 font-normal">{unit}</span>
              </span>
            </div>
          );
        })}
      </div>
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
