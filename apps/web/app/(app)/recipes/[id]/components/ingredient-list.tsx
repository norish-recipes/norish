"use client";

import { useState } from "react";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { CheckIcon } from "@heroicons/react/20/solid";
import { useLocale } from "next-intl";

import type { UnitsMap } from "@norish/config/zod/server-config";
import { useUnitFormatter as useSharedUnitFormatter } from "@norish/shared-react/hooks";
import { formatAmount } from "@norish/shared/lib/format-amount";

import { useRecipeContextRequired } from "../context";

type IngredientLike = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

type ReadonlyIngredientsListProps = {
  ingredients: IngredientLike[];
  systemUsed: string;
  interactive?: boolean;
  units?: UnitsMap;
};

type ReadonlyIngredientsListContentProps = Omit<ReadonlyIngredientsListProps, "units"> & {
  formatUnitOnly: (unit: string | null | undefined, amount?: number | null | undefined) => string;
};

function ReadonlyIngredientsListContent({
  ingredients,
  systemUsed,
  interactive = false,
  formatUnitOnly,
}: ReadonlyIngredientsListContentProps) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const { mode } = useAmountDisplayPreference();

  const toggle = (idx: number) => {
    if (!interactive) {
      return;
    }

    setChecked((prev) => {
      const next = new Set(prev);

      if (next.has(idx)) next.delete(idx);
      else next.add(idx);

      return next;
    });
  };

  const onKeyToggle = (e: React.KeyboardEvent, idx: number) => {
    if (!interactive) {
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(idx);
    }
  };

  return (
    <ul className="space-y-2">
      {ingredients
        .filter((it) => it.systemUsed === systemUsed)
        .sort((a, b) => a.order - b.order)
        .map((it, idx) => {
          const isHeading = it.ingredientName.trim().startsWith("#");

          if (isHeading) {
            const headingText = it.ingredientName.trim().replace(/^#+\s*/, "");

            return (
              <li key={`heading-${idx}`} className="list-none">
                <div className="px-3 py-2">
                  <h3 className="text-foreground text-base font-semibold">{headingText}</h3>
                </div>
              </li>
            );
          }

          const amount = formatAmount(it.amount, mode);
          const unit = it.unit ? formatUnitOnly(it.unit, it.amount) : "";
          const isChecked = checked.has(idx);
          const wrapperClassName = interactive
            ? `group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 select-none ${
                isChecked
                  ? "bg-default-100/50 dark:bg-default-100/5"
                  : "hover:bg-default-100 dark:hover:bg-default-100/10"
              }`
            : "flex items-start gap-3 rounded-xl px-3 py-2.5";

          return (
            <li key={`${it.ingredientName}-${idx}`}>
              <div
                aria-pressed={interactive ? isChecked : undefined}
                className={wrapperClassName}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={() => toggle(idx)}
                onKeyDown={(e) => onKeyToggle(e, idx)}
              >
                {interactive ? (
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                      isChecked
                        ? "border-success bg-success"
                        : "border-default-300 group-hover:border-primary-400 dark:border-default-600"
                    }`}
                  >
                    {isChecked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                  </div>
                ) : (
                  <span className="bg-default-100 mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
                )}

                <div
                  className={`flex flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 transition-opacity duration-200 ${
                    interactive && isChecked ? "opacity-50" : ""
                  }`}
                >
                  {amount !== "" && (
                    <span
                      className={`text-base font-bold tabular-nums ${
                        interactive && isChecked
                          ? "text-default-500 line-through"
                          : "text-foreground"
                      }`}
                    >
                      {amount}
                    </span>
                  )}
                  {unit && (
                    <span
                      className={`text-base font-bold ${
                        interactive && isChecked
                          ? "text-default-400 line-through"
                          : "text-primary-600 dark:text-primary-400"
                      }`}
                    >
                      {unit}
                    </span>
                  )}
                  <span
                    className={`text-base ${interactive && isChecked ? "text-default-400 line-through" : "text-base"}`}
                  >
                    <SmartMarkdownRenderer
                      disableLinks={interactive && isChecked}
                      text={it.ingredientName}
                    />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
    </ul>
  );
}

function ReadonlyIngredientsListWithConfiguredUnits({
  units,
  ...props
}: ReadonlyIngredientsListProps & { units: UnitsMap }) {
  const locale = useLocale();
  const { formatUnitOnly } = useSharedUnitFormatter({ locale, units });

  return <ReadonlyIngredientsListContent {...props} formatUnitOnly={formatUnitOnly} />;
}

function ReadonlyIngredientsListWithUserUnits(props: Omit<ReadonlyIngredientsListProps, "units">) {
  const { formatUnitOnly } = useUnitFormatter();

  return <ReadonlyIngredientsListContent {...props} formatUnitOnly={formatUnitOnly} />;
}

export function ReadonlyIngredientsList(props: ReadonlyIngredientsListProps) {
  if (props.units) {
    return <ReadonlyIngredientsListWithConfiguredUnits {...props} units={props.units} />;
  }

  return <ReadonlyIngredientsListWithUserUnits {...props} />;
}

export default function IngredientsList() {
  const { adjustedIngredients, recipe } = useRecipeContextRequired();
  const display = adjustedIngredients?.length > 0 ? adjustedIngredients : recipe.recipeIngredients;

  return (
    <ReadonlyIngredientsList interactive ingredients={display} systemUsed={recipe.systemUsed} />
  );
}
