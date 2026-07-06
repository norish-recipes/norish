"use client";

import { useMemo, useState } from "react";
import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import NutritionPortionControl from "@/components/recipes/nutrition-portion-control";
import { getNutritionData, MACROS } from "@/components/recipes/readonly-nutrition";
import AIActionButton from "@/components/shared/ai-action-button";
import { usePermissionsContext } from "@/context/permissions-context";
import { Card, Separator, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

function NutritionDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, isEstimatingNutrition, estimateNutrition } = useRecipeContext();
  const { isAIEnabled } = usePermissionsContext();
  const t = useTranslations("recipes.nutrition");
  // Independent portion state - defaults to 1 (per serving)
  const [portions, setPortions] = useState(1);

  const nutritionData = useMemo(() => {
    if (!recipe) return null;

    const values = getNutritionData(recipe, portions);
    const hasData = values.hasData;

    if (!hasData && !isAIEnabled) return null;

    return {
      hasData,
      values: values.values,
    };
  }, [recipe, portions, isAIEnabled]);

  if (!nutritionData) return null;

  const content = (
    <>
      <div className={`flex items-center justify-between ${inCard ? "mb-3" : ""}`}>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
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
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-muted text-base">{t("noInfo")}</p>
          {isAIEnabled && (
            <AIActionButton
              isLoading={isEstimatingNutrition}
              label={t("estimateWithAI")}
              onPress={estimateNutrition}
            />
          )}
        </div>
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

export function NutritionSection() {
  return <NutritionDisplay inCard={false} />;
}

export default function NutritionCard() {
  return <NutritionDisplay inCard={true} />;
}
