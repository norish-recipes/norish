"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, Button, Divider, Skeleton } from "@heroui/react";
import { SparklesIcon, FireIcon, BeakerIcon, CubeIcon, BoltIcon } from "@heroicons/react/16/solid";

import NutritionPortionControl from "./nutrition-portion-control";

import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import { usePermissionsContext } from "@/context/permissions-context";

const MACROS = [
  {
    key: "calories",
    label: "Calories",
    unit: "kcal",
    icon: FireIcon,
    color: "text-orange-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },
  {
    key: "fat",
    label: "Fat",
    unit: "g",
    icon: BeakerIcon,
    color: "text-yellow-500",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  {
    key: "carbs",
    label: "Carbs",
    unit: "g",
    icon: CubeIcon,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    key: "protein",
    label: "Protein",
    unit: "g",
    icon: BoltIcon,
    color: "text-rose-500",
    bg: "bg-rose-100 dark:bg-rose-900/30",
  },
] as const;

function NutritionDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, isEstimatingNutrition, estimateNutrition } = useRecipeContext();
  const { isAIEnabled } = usePermissionsContext();
  // Independent portion state - defaults to 1 (per serving)
  const [portions, setPortions] = useState(1);

  const nutritionData = useMemo(() => {
    if (!recipe) return null;

    const parsedFat = typeof recipe.fat === "string" ? parseFloat(recipe.fat) : recipe.fat;
    const parsedCarbs = typeof recipe.carbs === "string" ? parseFloat(recipe.carbs) : recipe.carbs;
    const parsedProtein =
      typeof recipe.protein === "string" ? parseFloat(recipe.protein) : recipe.protein;

    const hasData =
      recipe.calories != null || parsedFat != null || parsedCarbs != null || parsedProtein != null;

    if (!hasData && !isAIEnabled) return null;

    return {
      hasData,
      values: {
        // Values are stored per-serving, multiply by portions to scale
        calories: recipe.calories != null ? recipe.calories * portions : null,
        fat: parsedFat != null ? parsedFat * portions : null,
        carbs: parsedCarbs != null ? parsedCarbs * portions : null,
        protein: parsedProtein != null ? parsedProtein * portions : null,
      },
    };
  }, [recipe, portions, isAIEnabled]);

  if (!nutritionData) return null;

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="text-lg font-semibold">Nutrition</h2>
        {nutritionData.hasData && !isEstimatingNutrition && (
          <NutritionPortionControl portions={portions} onChange={setPortions} />
        )}
      </div>
      {isEstimatingNutrition ? (
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-md" />
              </div>
              <Skeleton className="h-4 w-12 rounded-md" />
            </div>
          ))}
        </div>
      ) : nutritionData.hasData ? (
        <>
          <div className="divide-default-100 divide-y">
            {MACROS.map(({ key, label, unit, icon: Icon, color, bg }) => {
              const value = nutritionData.values[key];

              if (value == null) return null;

              return (
                <div key={key} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <span className="text-default-700 text-base">{label}</span>
                  </div>
                  <span className="text-foreground text-base font-semibold">
                    {Math.round(value)}
                    <span className="text-default-500 ml-1 font-normal">{unit}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {portions !== 1 && (
            <p className="text-default-400 mt-2 text-center text-xs">
              Showing values for {portions} {portions === 1 ? "portion" : "portions"}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-default-500 text-base">No nutrition information available</p>
          {isAIEnabled && (
            <Button
              className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110"
              size="sm"
              startContent={<SparklesIcon className="h-4 w-4" />}
              onPress={estimateNutrition}
            >
              Estimate with AI
            </Button>
          )}
        </div>
      )}
    </>
  );

  return inCard ? (
    <Card className="bg-content1 rounded-2xl shadow-md">
      <CardBody className="p-5">{content}</CardBody>
    </Card>
  ) : (
    <>
      <Divider />
      <div className="space-y-2">{content}</div>
    </>
  );
}

export function NutritionSection() {
  return <NutritionDisplay inCard={false} />;
}

export default function NutritionCard() {
  return <NutritionDisplay inCard={true} />;
}
