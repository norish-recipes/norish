"use client";

import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { Label, NumberField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { LineProduct } from "@norish/shared/lib/line-cost";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { lineCost } from "@norish/shared/lib/line-cost";
import { unitLabel } from "@norish/shared/lib/units";

/** The purchase count is independent of the recipe's original requirement. */
export function GroceryPurchaseAmount({
  raw,
  product,
  value,
  onChange,
}: {
  raw: string;
  product: LineProduct;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations("groceries.picker");
  const { units } = useUnitsQuery();
  const ingredient = parseIngredientWithDefaults(raw, units)[0];
  const calculated = lineCost(
    { amount: ingredient?.quantity, unit: ingredient?.unitOfMeasure },
    product
  );
  const byWeight = product.pack?.byWeight;
  const label =
    byWeight && product.pack
      ? `${t("amount")} (${product.pack.quantity === 1 ? "" : `${product.pack.quantity} `}${unitLabel(product.pack.unit)})`
      : t("amount");

  return (
    <div className="min-w-0 flex-1">
      <NumberField
        minValue={byWeight ? 0.001 : 1}
        maxValue={9999999}
        step={byWeight ? 0.1 : 1}
        formatOptions={{ maximumFractionDigits: byWeight ? 3 : 0 }}
        value={value ?? calculated.purchaseAmount}
        variant="secondary"
        onChange={(amount) => onChange(Number.isFinite(amount) ? amount : null)}
      >
        <Label>{label}</Label>
        <NumberField.Group className="h-12">
          <NumberField.DecrementButton />
          <NumberField.Input
            className="min-w-0 text-center text-base"
            data-testid="grocery-purchase-amount"
          />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    </div>
  );
}
