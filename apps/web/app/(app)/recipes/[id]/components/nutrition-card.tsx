"use client";

import { useCallback, useState } from "react";
import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import { useTRPC } from "@/app/providers/trpc-provider";
import NutritionPortionControl from "@/components/recipes/nutrition-portion-control";
import { getNutritionData, NutritionBody } from "@/components/recipes/readonly-nutrition";
import { useWorkedOutNutrition } from "@/hooks/recipes/use-worked-out-nutrition";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { ChevronRightIcon } from "@heroicons/react/16/solid";
import { Card, Chip, Skeleton } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import type { LeftOutReason, WorkedOutNutrition } from "@norish/shared/lib/recipe-nutrition";
import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";
import { PANEL_REASONS } from "@norish/shared/lib/recipe-nutrition";

/** Why a line was left out, in the card's words. */
const REASON_KEYS = {
  seasoning: "reasons.seasoning",
  "no-amount": "reasons.noAmount",
  "no-size": "reasons.noSize",
  "no-numbers": "reasons.noNumbers",
  "no-spoon-weight": "reasons.noSpoonWeight",
  "no-piece-weight": "reasons.noPieceWeight",
} as const satisfies Record<LeftOutReason, string>;

/**
 * Whether the Nutrition Information section has anything to show: something
 * stored, a total worked out from the lines, or a run in flight. Queued and
 * processing both render as "working"; a quiet automatic failure simply
 * leaves the panel showing whatever is there. A reader who has hidden
 * Nutrition Information sees no section at all, even mid-run — the four
 * values leave together, and enrichment keeps storing regardless.
 */
export function useNutritionSectionVisible(): boolean {
  const { recipe, enrichment } = useRecipeContext();
  const { showNutrition } = useHiddenItemVisibility();
  const workedOut = useWorkedOutNutrition(recipe ?? null);

  if (!recipe || !showNutrition) return false;

  return (
    getNutritionData(recipe, 1).hasData ||
    workedOut?.perServing != null ||
    enrichment.isBusy("nutrition-estimation")
  );
}

/**
 * Nutrition Information on the recipe page, following the Recipe Provenance
 * rules: the section is absent when nothing is stored, nothing can be worked
 * out and nothing is running, a run in flight renders as working rather than
 * naming its lifecycle state, and both asking for a run and seeing that one
 * failed live in the actions menu — the card itself never reports enrichment
 * state.
 *
 * What the recipe supplies always wins. Without it, the total is worked out
 * from the lines for the reader's household (ADR-0039): it says when it is
 * estimated, names the lines it could not count, and credits the datasets
 * it used. The values themselves are the shared rendering, so the macro ring
 * is one picture kept honest in one place across mobile, desktop and the
 * share page.
 */
export default function NutritionCard() {
  const { recipe, enrichment } = useRecipeContext();
  const isEstimatingNutrition = enrichment.isBusy("nutrition-estimation");
  const t = useTranslations("recipes.nutrition");
  const isVisible = useNutritionSectionVisible();
  const workedOut = useWorkedOutNutrition(recipe ?? null);
  // Independent portion state - defaults to 1 (per serving)
  const [portions, setPortions] = useState(1);

  if (!recipe || !isVisible) return null;

  const stored = getNutritionData(recipe, 1).hasData;
  const shown = stored
    ? recipe
    : workedOut?.perServing
      ? {
          calories: workedOut.perServing.calories,
          fat: workedOut.perServing.fat,
          carbs: workedOut.perServing.carbs,
          protein: workedOut.perServing.protein,
        }
      : null;

  return (
    <Card className="rounded-2xl" data-testid="nutrition-card">
      <Card.Content className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            {!stored && workedOut?.estimated ? (
              <Chip data-testid="nutrition-estimated" size="sm" variant="soft">
                {t("estimated")}
              </Chip>
            ) : null}
          </div>
          {shown && !isEstimatingNutrition && (
            <NutritionPortionControl portions={portions} onChange={setPortions} />
          )}
        </div>
        {isEstimatingNutrition ? (
          <div className="flex items-center gap-5">
            <Skeleton className="size-32 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-4 w-12 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : shown ? (
          <>
            <NutritionBody
              marked={!stored && (workedOut?.leftOut.length ?? 0) > 0}
              portions={portions}
              recipe={shown}
            />
            {portions !== 1 && (
              <p className="text-muted mt-2 text-center text-xs">
                {t("showingPortions", { count: portions })}
              </p>
            )}
            {!stored && workedOut ? <WorkedOutNotes workedOut={workedOut} /> : null}
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/**
 * Under a worked-out total: how many lines it left out, behind the asterisk
 * on its calories, opening in place to name each with why (or as the
 * language model's estimate), and where the numbers came from. A line whose
 * fix is a fact in its food's panel opens that panel right here, so it can
 * be given a spoon weight or numbers without leaving the recipe; an edit
 * made there re-reads the foods' facts, so the total above follows it.
 */
function WorkedOutNotes({ workedOut }: { workedOut: WorkedOutNutrition }) {
  const t = useTranslations("recipes.nutrition");
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [listOpen, setListOpen] = useState(false);
  const [openIngredientId, setOpenIngredientId] = useState<string | null>(null);
  const onChanged = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.nutritionFor.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.list.pathKey() }),
      ]),
    [queryClient, trpc]
  );
  const sources = [
    ...workedOut.credits.map((credit) => NUTRITION_CREDIT_NAMES[credit]),
    ...(workedOut.household ? [t("householdNumbers")] : []),
  ];

  return (
    <div className="mt-3 flex flex-col gap-2 text-sm">
      {workedOut.leftOut.length > 0 ? (
        <div data-state={listOpen ? "open" : "closed"}>
          <button
            aria-expanded={listOpen}
            className="text-muted hover:text-foreground flex items-center gap-1 text-left transition-colors"
            data-testid="nutrition-left-out-toggle"
            type="button"
            onClick={() => setListOpen((wasOpen) => !wasOpen)}
          >
            <span aria-hidden>*</span>
            <span>{t("leftOut", { count: workedOut.leftOut.length })}</span>
            <ChevronRightIcon
              className={`size-4 shrink-0 transition-transform ${listOpen ? "rotate-90" : ""}`}
            />
          </button>
          {listOpen ? (
            <ul className="mt-2 flex flex-col gap-1" data-testid="nutrition-left-out">
              {workedOut.leftOut.map(({ lineId, name, ingredientId, reason, estimatedByAI }) => (
                <li
                  key={lineId}
                  className="flex flex-wrap items-baseline gap-x-2"
                  data-reason={estimatedByAI ? "estimated-by-ai" : reason}
                  data-testid="nutrition-left-out-line"
                >
                  {ingredientId && PANEL_REASONS.has(reason) ? (
                    <button
                      className="text-accent hover:underline"
                      type="button"
                      onClick={() => setOpenIngredientId(ingredientId)}
                    >
                      {name}
                    </button>
                  ) : (
                    <span>{name}</span>
                  )}
                  <span className="text-muted text-xs">
                    {estimatedByAI ? t("estimatedByAI") : t(REASON_KEYS[reason])}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="text-muted text-xs" data-testid="nutrition-credit">
        {t("workedOutFrom", { sources: format.list(sources, { type: "conjunction" }) })}
      </p>
      <IngredientPanel
        id={openIngredientId}
        item={null}
        open={openIngredientId !== null}
        onChanged={onChanged}
        onClose={() => setOpenIngredientId(null)}
      />
    </div>
  );
}
