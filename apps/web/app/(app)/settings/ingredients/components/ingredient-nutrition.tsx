"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel from "@/components/Panel/Panel";
import { ChevronRightIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";

import { CUP_ML, factSource } from "./nutrition-copy";
import { NutritionCorrectionPanel } from "./nutrition-correction-panel";

/**
 * An Ingredient's nutrition in its panel (ADR-0039): one row saying the
 * calories per 100 g, which opens a panel of its own with the four numbers,
 * what one piece weighs and what a cup weighs, each with where it came from
 * ("Onion, raw · CIQUAL 2025", "from onion"), or that Norish does not know.
 * Any member may correct them for the household, seeded food or not: the
 * edit policy does not apply to a correction.
 */
export function IngredientNutritionSection({
  ingredientId,
  name,
}: {
  ingredientId: string;
  name: string;
}) {
  const t = useTranslations("settings.ingredients.nutrition");
  const tActions = useTranslations("common.actions");
  const format = useFormatter();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  // Each opening of the correction panel is a fresh draft.
  const [opening, setOpening] = useState(0);
  const { data, isPending } = useQuery(trpc.ingredients.nutrition.queryOptions({ ingredientId }));
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });
  const facts = data ?? null;

  return (
    <section className="flex flex-col gap-2" data-testid="ingredient-nutrition">
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">{t("section")}</h3>
      {isPending ? (
        <Skeleton className="h-9 w-full rounded-3xl md:h-8" />
      ) : (
        <Button
          fullWidth
          className="justify-between"
          data-testid="ingredient-nutrition-open"
          variant="tertiary"
          onPress={() => setOpen(true)}
        >
          <span data-testid="ingredient-nutrition-summary">
            {facts?.numbers
              ? t("summary", { value: number(facts.numbers.value.kcal) })
              : t("summaryNone")}
          </span>
          <ChevronRightIcon className="size-4" />
        </Button>
      )}
      <Panel
        nested
        className="contents"
        open={open}
        title={t("section")}
        onOpenChange={(isOpen) => {
          if (!isOpen) setOpen(false);
        }}
      >
        <Panel.Body>
          <div className="flex flex-col gap-3 pb-2" data-testid="ingredient-nutrition-details">
            <NutritionFacts facts={facts} number={number} />
          </div>
        </Panel.Body>
        <Panel.Footer>
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              data-testid="ingredient-nutrition-correct"
              variant="secondary"
              onPress={() => {
                setOpening((count) => count + 1);
                setCorrecting(true);
              }}
            >
              <PencilSquareIcon className="size-4" />
              {t("correct")}
            </Button>
            <Button variant="tertiary" onPress={() => setOpen(false)}>
              {tActions("done")}
            </Button>
          </div>
        </Panel.Footer>
        <NutritionCorrectionPanel
          key={opening}
          current={facts}
          ingredientId={ingredientId}
          name={name}
          open={correcting}
          onClose={() => setCorrecting(false)}
        />
      </Panel>
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

  // One table, a line between rows and none at the sides: the four numbers
  // per 100 g with where they came from beneath, then what a piece and a cup weigh.
  return (
    <dl className="divide-border flex flex-col divide-y text-sm">
      {facts.numbers ? (
        <div
          className="flex flex-col divide-y divide-inherit"
          data-testid="ingredient-nutrition-numbers"
        >
          <Fact hint={t("per100g")} label={t("calories")}>
            {t("kcal", { value: number(facts.numbers.value.kcal) })}
          </Fact>
          <Fact label={t("fat")}>{t("grams", { value: number(facts.numbers.value.fat) })}</Fact>
          <Fact label={t("carbs")}>{t("grams", { value: number(facts.numbers.value.carbs) })}</Fact>
          <Fact label={t("protein")}>
            {t("grams", { value: number(facts.numbers.value.protein) })}
          </Fact>
          {/* The four numbers share one source: it sits under them all, not under Protein. */}
          <p className="text-muted py-2 text-xs" data-testid="ingredient-nutrition-source">
            {factSource(t, facts.numbers)}
          </p>
        </div>
      ) : (
        <p className="text-muted py-2">{t("noNumbers")}</p>
      )}
      {facts.pieceWeight ? (
        <div data-testid="ingredient-nutrition-piece">
          <Fact label={t("onePieceLabel")} source={factSource(t, facts.pieceWeight)}>
            {t("grams", { value: number(facts.pieceWeight.value) })}
          </Fact>
        </div>
      ) : null}
      {facts.density ? (
        <div data-testid="ingredient-nutrition-density">
          <Fact label={t("oneCupLabel")} source={factSource(t, facts.density)}>
            {t("grams", { value: number(facts.density.value * CUP_ML) })}
          </Fact>
        </div>
      ) : null}
    </dl>
  );
}

/** One row: the label left, the number right, and beneath them a hint ("Per 100 g") or where the number came from. */
function Fact({
  label,
  hint,
  source,
  children,
}: {
  label: string;
  hint?: string;
  source?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col py-2">
      <div className="flex items-baseline justify-between gap-4">
        <dt>{label}</dt>
        <dd className="font-medium tabular-nums">{children}</dd>
      </div>
      {hint ? <p className="text-muted text-xs">{hint}</p> : null}
      {source ? <p className="text-muted text-xs">{source}</p> : null}
    </div>
  );
}
