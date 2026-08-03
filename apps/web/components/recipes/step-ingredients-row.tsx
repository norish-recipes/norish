"use client";

import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
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

  return (
    <ul className="flex flex-wrap gap-1.5">
      {resolved.map((item) => {
        const amount = item.amount != null ? formatAmount(item.amount, mode) : "";
        const unit = item.unit ? formatUnitOnly(item.unit, item.amount) : "";
        const label = [amount, unit, item.name].filter(Boolean).join(" ");

        return (
          <li
            key={`${item.ingredientOrder}`}
            className="bg-surface-secondary text-muted rounded-md px-2 py-0.5 text-sm"
          >
            {label}
          </li>
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
