import { FireIcon, MoonIcon, SparklesIcon, SunIcon } from "@heroicons/react/16/solid";

import { Slot } from "@norish/shared/contracts";

export function MealIcon({
  slot,
  className = "h-4 w-4 shrink-0 text-default-500",
}: {
  slot: Slot;
  className?: string;
}) {
  const Icon =
    slot === "Breakfast"
      ? SunIcon
      : slot === "Lunch"
        ? FireIcon
        : slot === "Dinner"
          ? MoonIcon
          : SparklesIcon;

  return <Icon className={className} />;
}
