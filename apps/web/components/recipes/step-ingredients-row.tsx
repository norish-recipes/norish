"use client";

import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";
import { useHiddenItemsIfProvided } from "@/context/hidden-items-context";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { Chip } from "@heroui/react";
import { useLocale } from "next-intl";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { StepIngredientRefLike } from "@norish/shared/lib/step-ingredients";
import { useUnitFormatter as useSharedUnitFormatter } from "@norish/shared-react/hooks";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { resolveStepIngredients } from "@norish/shared/lib/step-ingredients";

type IngredientLike = {
  ingredientName: string;
  amount?: number | string | null;
  unit?: string | null;
  systemUsed: string;
  order: number;
  /** The picture the line's name resolves to (ADR-0037). */
  picture?: { imageUrl: string } | null;
};

export type StepIngredientsRowProps = {
  refs: StepIngredientRefLike[];
  ingredients: IngredientLike[];
  systemUsed: string;
  /** Public surfaces pass their shared unit config; private ones omit it. */
  units?: UnitsMap;
};

type StepIngredientsRowContentProps = Omit<StepIngredientsRowProps, "units"> & {
  formatUnitOnly: (unit: string | null | undefined, amount?: number | null | undefined) => string;
};

/**
 * A step's Step Ingredients, presented with the step: the resolved names and
 * amounts of the lines it uses, derived at this moment from the live lines —
 * so they follow every edit, the active measurement system, and the servings
 * control, exactly like the ingredient list above them. A line with no
 * amount shows its name only.
 */
function StepIngredientsRowContent({
  refs,
  ingredients,
  systemUsed,
  formatUnitOnly,
}: StepIngredientsRowContentProps) {
  const { mode } = useAmountDisplayPreference();
  const picturesHidden = useHiddenItemsIfProvided().includes("ingredientPictures");
  const resolved = resolveStepIngredients(
    refs,
    ingredients.map((ingredient) => ({
      ingredientName: ingredient.ingredientName,
      amount:
        ingredient.amount == null || ingredient.amount === "" ? null : Number(ingredient.amount),
      unit: ingredient.unit ?? null,
      systemUsed: ingredient.systemUsed,
      order: ingredient.order,
    })),
    systemUsed
  );

  if (resolved.length === 0) return null;

  // The picture belongs to the line a chip resolves to, found the same way.
  const pictureByOrder = new Map<number, string>();

  for (const ingredient of picturesHidden ? [] : ingredients) {
    const imageUrl = ingredient.picture?.imageUrl;

    if (ingredient.systemUsed === systemUsed && imageUrl && !pictureByOrder.has(ingredient.order)) {
      pictureByOrder.set(ingredient.order, imageUrl);
    }
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {resolved.map((item) => {
        const amount = item.amount != null ? formatAmount(item.amount, mode) : "";
        const unit = item.unit ? formatUnitOnly(item.unit, item.amount) : "";
        const label = [amount, unit, item.name].filter(Boolean).join(" ");

        return (
          <Chip<"li">
            key={`${item.ingredientOrder}`}
            className={`rounded-full py-1 pr-2.5 text-sm ${
              pictureByOrder.has(item.ingredientOrder) ? "gap-1.5 pl-1" : "pl-2.5"
            }`}
            render={(props) => <li {...props} />}
            variant="tertiary"
          >
            <IngredientIllustration
              className="rounded-full"
              imageUrl={pictureByOrder.get(item.ingredientOrder)}
              size="xs"
            />
            {label}
          </Chip>
        );
      })}
    </ul>
  );
}

function StepIngredientsRowWithConfiguredUnits(
  props: StepIngredientsRowProps & { units: UnitsMap }
) {
  const locale = useLocale();
  const { formatUnitOnly } = useSharedUnitFormatter({ locale, units: props.units });

  return <StepIngredientsRowContent {...props} formatUnitOnly={formatUnitOnly} />;
}

function StepIngredientsRowWithUserUnits(props: Omit<StepIngredientsRowProps, "units">) {
  const { formatUnitOnly } = useUnitFormatter();

  return <StepIngredientsRowContent {...props} formatUnitOnly={formatUnitOnly} />;
}

export function StepIngredientsRow(props: StepIngredientsRowProps) {
  if (props.units) {
    return <StepIngredientsRowWithConfiguredUnits {...props} units={props.units} />;
  }

  return <StepIngredientsRowWithUserUnits {...props} />;
}
