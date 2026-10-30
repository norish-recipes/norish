"use client";

import { useState } from "react";
import { GroceryCheckbox } from "@/components/groceries/grocery-checkbox";
import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import { AnimatedNumber } from "@/components/recipes/animated-number";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { useLocale } from "next-intl";

import type { UnitsMap } from "@norish/config/zod/server-config";
import { createUnitFormatter } from "@norish/shared-react/hooks";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

type IngredientLike = {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
  /** The line's food, whose icon the surface read; absent until the server resolved it. */
  ingredientId?: string | null;
  /** The icon's address outright, where the surface has no ids to look it up by. */
  icon?: string | null;
};

export type ReadonlyIngredientsListProps = {
  ingredients: IngredientLike[];
  systemUsed: string;
  interactive?: boolean;
  units?: UnitsMap;
  checkedIndices?: Set<number>;
  onCheckedIndicesChange?: (indices: Set<number>) => void;
};

type ReadonlyIngredientsListContentProps = Omit<ReadonlyIngredientsListProps, "units"> & {
  formatUnitOnly: (unit: string | null | undefined, amount?: number | null | undefined) => string;
};

function ReadonlyIngredientsListContent({
  ingredients,
  systemUsed,
  interactive = false,
  formatUnitOnly,
  checkedIndices: controlledCheckedIndices,
  onCheckedIndicesChange,
}: ReadonlyIngredientsListContentProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = useState<Set<number>>(() => new Set());
  const { mode } = useAmountDisplayPreference();

  const checked = controlledCheckedIndices ?? uncontrolledChecked;

  const toggle = (idx: number) => {
    if (!interactive) {
      return;
    }

    const next = new Set(checked);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);

    if (onCheckedIndicesChange) {
      onCheckedIndicesChange(next);
    } else {
      setUncontrolledChecked(next);
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
              <li key={it.order} className="list-none">
                <div className="px-3 py-2">
                  <h3 className="text-foreground text-base font-semibold">{headingText}</h3>
                </div>
              </li>
            );
          }

          return (
            <IngredientLine
              key={it.order}
              amount={formatAmount(it.amount, mode)}
              icon={it.icon}
              idx={idx}
              ingredientId={it.ingredientId}
              ingredientName={it.ingredientName}
              interactive={interactive}
              isChecked={checked.has(idx)}
              unit={it.unit ? formatUnitOnly(it.unit, it.amount) : ""}
              onToggle={toggle}
            />
          );
        })}
    </ul>
  );
}

/**
 * One line of the list. Its own component so that a change to one line, or to
 * every line's amount when the servings change, re-renders the text alone and
 * not the checkbox and icon beside it.
 */
function IngredientLine({
  ingredientName,
  ingredientId,
  icon,
  amount,
  unit,
  idx,
  isChecked,
  interactive,
  onToggle,
}: {
  ingredientName: string;
  ingredientId?: string | null;
  icon?: string | null;
  amount: string;
  unit: string;
  idx: number;
  isChecked: boolean;
  interactive: boolean;
  onToggle: (idx: number) => void;
}) {
  const onKeyToggle = (e: React.KeyboardEvent) => {
    if (!interactive) {
      return;
    }

    if ((e.target as HTMLElement | null)?.closest("[data-ingredient-checkbox]")) {
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(idx);
    }
  };

  const onRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest("[data-ingredient-checkbox]")) {
      return;
    }

    onToggle(idx);
  };

  const wrapperClassName = interactive
    ? `group flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 md:gap-3 transition-all duration-200 select-none ${
        isChecked ? "bg-surface-secondary/50" : "hover:bg-surface-secondary"
      }`
    : "flex items-start gap-2 rounded-xl px-3 py-2.5 md:gap-3";

  return (
    <li>
      <div
        aria-pressed={interactive ? isChecked : undefined}
        className={wrapperClassName}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onRowClick}
        onKeyDown={onKeyToggle}
      >
        {interactive ? (
          <span data-ingredient-checkbox className="shrink-0">
            <GroceryCheckbox
              aria-label={ingredientName}
              isSelected={isChecked}
              size="md"
              onChange={() => onToggle(idx)}
            />
          </span>
        ) : (
          <span className="bg-surface-secondary mt-1 h-2.5 w-2.5 shrink-0 rounded-full" />
        )}

        {/* A line that names no food ("200 g" alone) gets no icon, like a heading. */}
        {namesNoFood(ingredientName) ? null : (
          <IngredientIcon
            className={interactive && isChecked ? "opacity-50" : undefined}
            ingredientId={ingredientId}
            src={icon}
          />
        )}

        <div
          className={`flex flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 transition-opacity duration-200 ${
            interactive && isChecked ? "opacity-50" : ""
          }`}
        >
          {amount !== "" && (
            // Servings and unit conversions both rewrite this in
            // place, so it moves rather than blinks.
            <AnimatedNumber
              className={`text-base font-bold ${
                interactive && isChecked ? "text-muted line-through" : "text-foreground"
              }`}
              value={amount}
            />
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
            <SmartMarkdownRenderer disableLinks={interactive && isChecked} text={ingredientName} />
          </span>
        </div>
      </div>
    </li>
  );
}

function ReadonlyIngredientsListWithConfiguredUnits({
  units,
  ...props
}: ReadonlyIngredientsListProps & { units: UnitsMap }) {
  const locale = useLocale();
  const { formatUnitOnly } = createUnitFormatter({ locale, units });

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
