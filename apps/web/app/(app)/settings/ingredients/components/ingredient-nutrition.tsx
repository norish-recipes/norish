"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";

import { CUP_ML, factSource } from "./nutrition-copy";
import { NutritionCorrectionPanel } from "./nutrition-correction-panel";

/**
 * An Ingredient's nutrition in its panel (ADR-0039): the four numbers per
 * 100 g, what one piece weighs and what a cup weighs, each with where it
 * came from ("Onion, raw · CIQUAL 2025", "from onion"), or that Norish does
 * not know. Any member may correct them for the household, seeded food or
 * not: the edit policy does not apply to a correction.
 */
export function IngredientNutritionSection({
  ingredientId,
  name,
}: {
  ingredientId: string;
  name: string;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const format = useFormatter();
  const trpc = useTRPC();
  const [correcting, setCorrecting] = useState(false);
  // Each opening of the correction panel is a fresh draft.
  const [opening, setOpening] = useState(0);
  const { data, isPending } = useQuery(trpc.ingredients.nutrition.queryOptions({ ingredientId }));
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  return (
    <section className="flex flex-col gap-2" data-testid="ingredient-nutrition">
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">{t("section")}</h3>
      {isPending ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : (
        <NutritionFacts facts={data ?? null} number={number} />
      )}
      <Button
        className="self-start"
        data-testid="ingredient-nutrition-correct"
        isDisabled={isPending}
        size="sm"
        variant="secondary"
        onPress={() => {
          setOpening((count) => count + 1);
          setCorrecting(true);
        }}
      >
        <PencilSquareIcon className="size-4" />
        {t("correct")}
      </Button>
      <NutritionCorrectionPanel
        key={opening}
        current={data ?? null}
        ingredientId={ingredientId}
        name={name}
        open={correcting}
        onClose={() => setCorrecting(false)}
      />
    </section>
  );
}

function NutritionFacts({
  facts,
  number,
}: {
  facts: IngredientNutrition | null;
  number: (value: number) => string;
}) {
  const t = useTranslations("settings.ingredients.nutrition");

  if (!facts?.numbers && !facts?.pieceWeight && !facts?.density) {
    return (
      <p className="text-muted text-sm" data-testid="ingredient-nutrition-none">
        {t("none")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {facts.numbers ? (
        <div className="flex flex-col gap-1" data-testid="ingredient-nutrition-numbers">
          <p className="text-sm font-medium">{t("per100g")}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <Fact label={t("calories")}>
              {t("kcal", { value: number(facts.numbers.value.kcal) })}
            </Fact>
            <Fact label={t("fat")}>{t("grams", { value: number(facts.numbers.value.fat) })}</Fact>
            <Fact label={t("carbs")}>
              {t("grams", { value: number(facts.numbers.value.carbs) })}
            </Fact>
            <Fact label={t("protein")}>
              {t("grams", { value: number(facts.numbers.value.protein) })}
            </Fact>
          </dl>
          <p className="text-muted text-xs" data-testid="ingredient-nutrition-source">
            {factSource(t, facts.numbers)}
          </p>
        </div>
      ) : (
        <p className="text-muted text-sm">{t("noNumbers")}</p>
      )}
      {facts.pieceWeight ? (
        <div className="flex flex-col" data-testid="ingredient-nutrition-piece">
          <p className="text-sm">{t("onePiece", { grams: number(facts.pieceWeight.value) })}</p>
          <p className="text-muted text-xs">{factSource(t, facts.pieceWeight)}</p>
        </div>
      ) : null}
      {facts.density ? (
        <div className="flex flex-col" data-testid="ingredient-nutrition-density">
          <p className="text-sm">{t("oneCup", { grams: number(facts.density.value * CUP_ML) })}</p>
          <p className="text-muted text-xs">{factSource(t, facts.density)}</p>
        </div>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}
