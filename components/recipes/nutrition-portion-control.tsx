"use client";

import { Button } from "@heroui/react";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";

export interface NutritionPortionControlProps {
  portions: number;
  onChange: (portions: number) => void;
}

export default function NutritionPortionControl({ portions, onChange }: NutritionPortionControlProps) {
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

  const formatPortions = (n: number): string => {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace(/\.?0+$/, "");
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        isIconOnly
        aria-label="Decrease portions"
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={dec}
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <span className="min-w-8 text-center text-sm">{formatPortions(portions)}</span>
      <Button
        isIconOnly
        aria-label="Increase portions"
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={inc}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
