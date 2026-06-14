"use client";

import type { Ref } from "react";
import { useState } from "react";
import { GroceryCheckbox } from "@/components/groceries/grocery-checkbox";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { useLocale } from "next-intl";

import type { UnitsMap } from "@norish/config/zod/server-config";
import { useUnitFormatter as useSharedUnitFormatter } from "@norish/shared-react/hooks";
import { getIngredientLinkCandidateKey } from "@norish/shared-react/text";
import { formatAmount } from "@norish/shared/lib/format-amount";

type IngredientLike = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

export type ReadonlyIngredientsListProps = {
  ingredients: IngredientLike[];
  systemUsed: string;
  interactive?: boolean;
  units?: UnitsMap;
  highlightedIngredientKey?: string | null;
  ingredientListRef?: Ref<HTMLUListElement>;
};

type ReadonlyIngredientsListContentProps = Omit<ReadonlyIngredientsListProps, "units"> & {
  formatUnitOnly: (unit: string | null | undefined, amount?: number | null | undefined) => string;
};

function ReadonlyIngredientsListContent({
  ingredients,
  systemUsed,
  interactive = false,
  highlightedIngredientKey,
  ingredientListRef,
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

    if ((e.target as HTMLElement | null)?.closest("[data-ingredient-checkbox]")) {
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(idx);
    }
  };

  const onRowClick = (e: React.MouseEvent, idx: number) => {
    if ((e.target as HTMLElement | null)?.closest("[data-ingredient-checkbox]")) {
      return;
    }

    toggle(idx);
  };

  return (
    <ul ref={ingredientListRef} className="space-y-2">
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
          const ingredientKey = getIngredientLinkCandidateKey({
            ingredientName: it.ingredientName,
            systemUsed: it.systemUsed,
          });
          const isHighlighted = highlightedIngredientKey === ingredientKey;
          const wrapperClassName = interactive
            ? `group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 select-none ${
                isChecked
                  ? "bg-surface-secondary/50"
                  : isHighlighted
                    ? "bg-accent/10 ring-accent/30 ring-1"
                    : "hover:bg-surface-secondary"
              }`
            : `flex items-start gap-3 rounded-xl px-3 py-2.5 ${
                isHighlighted ? "bg-accent/10 ring-accent/30 ring-1" : ""
              }`;

          return (
            <li key={`${it.ingredientName}-${idx}`}>
              <div
                aria-pressed={interactive ? isChecked : undefined}
                className={wrapperClassName}
                data-ingredient-link-key={ingredientKey}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={(e) => onRowClick(e, idx)}
                onKeyDown={(e) => onKeyToggle(e, idx)}
              >
                {interactive ? (
                  <span data-ingredient-checkbox className="shrink-0">
                    <GroceryCheckbox
                      aria-label={it.ingredientName}
                      isSelected={isChecked}
                      size="md"
                      onChange={() => toggle(idx)}
                    />
                  </span>
                ) : (
                  <span className="bg-surface-secondary mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
                )}

                <div
                  className={`flex flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 transition-opacity duration-200 ${
                    interactive && isChecked ? "opacity-50" : ""
                  }`}
                >
                  {amount !== "" && (
                    <span
                      className={`text-base font-bold tabular-nums ${
                        interactive && isChecked ? "text-muted line-through" : "text-foreground"
                      }`}
                    >
                      {amount}
                    </span>
                  )}
                  {unit && (
                    <span
                      className={`text-base font-bold ${
                        interactive && isChecked ? "text-muted line-through" : "text-accent"
                      }`}
                    >
                      {unit}
                    </span>
                  )}
                  <span
                    className={`text-base ${interactive && isChecked ? "text-muted line-through" : "text-base"}`}
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
