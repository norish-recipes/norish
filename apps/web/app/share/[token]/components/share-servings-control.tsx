"use client";

import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);

  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function ShareServingsControl({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (servings: number) => void;
}) {
  const decrease = () => {
    if (servings <= 1) onChange(Math.max(0.125, servings / 2));
    else if (servings <= 2) onChange(1);
    else onChange(servings - 1);
  };
  const increase = () => {
    if (servings < 1) onChange(Math.min(1, servings * 2));
    else onChange(servings + 1);
  };

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
      <span className="min-w-8 text-center text-sm">{formatServings(servings)}</span>
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
