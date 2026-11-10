"use client";

import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { servingsDown, servingsUp } from "@norish/shared-react/recipes";
import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

import { AnimatedNumber } from "./animated-number";

export interface NutritionPortionControlProps {
  portions: number;
  onChange: (portions: number) => void;
}
export default function NutritionPortionControl({
  portions,
  onChange,
}: NutritionPortionControlProps) {
  const dec = () => onChange(servingsDown(portions));
  const inc = () => onChange(servingsUp(portions));

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        isIconOnly
        aria-label="Decrease portions"
        className="bg-surface-secondary"
        size="sm"
        onPress={dec}
        variant="tertiary"
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <AnimatedNumber
        className="min-w-8 justify-center text-sm"
        value={formatAmountAsDecimal(portions)}
      />
      <Button
        isIconOnly
        aria-label="Increase portions"
        className="bg-surface-secondary"
        size="sm"
        onPress={inc}
        variant="tertiary"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
