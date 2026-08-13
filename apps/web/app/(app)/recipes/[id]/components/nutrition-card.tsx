"use client";

import { useMemo, useState } from "react";
import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import NutritionPortionControl from "@/components/recipes/nutrition-portion-control";
import { getNutritionData, MACROS } from "@/components/recipes/readonly-nutrition";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { Card, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Whether the Nutrition Information section has anything to show: something
 * stored, or a run in flight. Queued and processing both render as "working";
 * a quiet automatic failure simply leaves the panel showing whatever is
 * stored. A reader who has hidden Nutrition Information sees no section at
 * all, even mid-run — the four values leave together, and enrichment keeps
 * storing regardless. The page layouts read this too, so the rules they
 * draw between sections come from the same answer the section itself
 * renders by.
 */
export function useNutritionSectionVisible(): boolean {
  const { recipe, enrichment } = useRecipeContext();
  const { showNutrition } = useHiddenItemVisibility();

  if (!recipe || !showNutrition) return false;

  return getNutritionData(recipe, 1).hasData || enrichment.isBusy("nutrition-estimation");
}

/**
 * Nutrition Information on the recipe page, following the Recipe Provenance
 * rules: the section is absent when nothing is stored and nothing is running,
 * a run in flight renders as working rather than naming its lifecycle state,
 * and both asking for a run and seeing that one failed live in the actions
 * menu — the card itself never reports enrichment state.
 */
function NutritionDisplay({ inCard = true }: { inCard?: boolean }) {
  const { recipe, enrichment } = useRecipeContext();
  const isEstimatingNutrition = enrichment.isBusy("nutrition-estimation");
  const t = useTranslations("recipes.nutrition");
  const isVisible = useNutritionSectionVisible();
  // Independent portion state - defaults to 1 (per serving)
  const [portions, setPortions] = useState(1);

  const nutritionData = useMemo(() => {
    if (!recipe) return null;

    const values = getNutritionData(recipe, portions);

    return {
      hasData: values.hasData,
      values: values.values,
    };
  }, [recipe, portions]);

  if (!nutritionData || !isVisible) return null;

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
      ) : (
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
      )}
    </>
  );

  // As a section the display draws no rule of its own: the page owns the
  // rhythm between sections.
  return inCard ? (
    <Card className="rounded-2xl">
      <Card.Content className="p-5">{content}</Card.Content>
    </Card>
  ) : (
    <div className="space-y-2">{content}</div>
  );
}

export function NutritionSection() {
  return <NutritionDisplay inCard={false} />;
}

export default function NutritionCard() {
  return <NutritionDisplay inCard={true} />;
}
