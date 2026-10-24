"use client";

import { AnimatedNumber } from "@/components/recipes/animated-number";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

export interface NutritionPortionControlProps {
  portions: number;
  onChange: (portions: number) => void;
}
export default function NutritionPortionControl({
  portions,
  onChange,
}: NutritionPortionControlProps) {
  const dec = () => {
    if (portions <= 1) {
      onChange(Math.max(0.125, portions / 2));
    } else if (portions <= 2) {
      onChange(1);
    } else {
      onChange(portions - 1);
    }
  };
  const inc = () => {
    if (portions < 1) {
      onChange(Math.min(1, portions * 2));
    } else {
      onChange(portions + 1);
    }
  };
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
