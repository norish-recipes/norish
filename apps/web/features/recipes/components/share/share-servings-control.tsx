"use client";

import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { servingsDown, servingsUp } from "@norish/shared-react/recipes";
import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

export function ShareServingsControl({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (servings: number) => void;
}) {
  const decrease = () => onChange(servingsDown(servings));
  const increase = () => onChange(servingsUp(servings));

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        isIconOnly
        aria-label="Decrease servings"
        className="bg-surface-secondary"
        size="sm"
        variant="tertiary"
        onPress={decrease}
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <span className="min-w-8 text-center text-sm">{formatAmountAsDecimal(servings)}</span>
      <Button
        isIconOnly
        aria-label="Increase servings"
        className="bg-surface-secondary"
        size="sm"
        variant="tertiary"
        onPress={increase}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
