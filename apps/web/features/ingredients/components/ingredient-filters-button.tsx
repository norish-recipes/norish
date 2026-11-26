"use client";

import { FunnelIcon } from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

/** The button in the Ingredients search that opens the filters; a dot says one is on. */
export function IngredientFiltersButton({
  active = false,
  isDisabled = false,
  onPress,
}: {
  active?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
}) {
  const tFilters = useTranslations("common.filters");

  return (
    <Button
      isIconOnly
      aria-label={tFilters("title")}
      className="relative"
      data-testid="ingredients-filters"
      isDisabled={isDisabled}
      size="sm"
      variant="ghost"
      onPress={onPress}
    >
      <FunnelIcon className="size-4" />
      {active ? (
        <span className="bg-accent absolute top-1 right-1 inline-flex size-2 rounded-full" />
      ) : null}
    </Button>
  );
}
