"use client";

import FallbackImage from "@/components/shared/fallback-image";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { Button, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { addBasePathToUrl } from "@norish/shared/lib/base-path";
import { formatMinutesHM } from "@norish/shared/lib/helpers";

import type { CookingModeRecipe } from "./types";

type CookingModeHeaderProps = {
  recipe: CookingModeRecipe;
  onClose: () => void;
};

/**
 * Cooking mode's header: enough to know which recipe is on screen, and
 * nothing else. The Steps/Ingredients tab bar is gone — the horizontal swipe
 * and the bottom bar's button both reach the ingredients, and the screen
 * belongs to the step.
 */
export function CookingModeHeader({ recipe, onClose }: CookingModeHeaderProps) {
  const tForm = useTranslations("recipes.form");
  const tCommon = useTranslations("common.actions");

  const subtitle = [
    recipe.categories.map((category) => tForm(`category.${category.toLowerCase()}`)).join(", "),
    recipe.totalMinutes ? formatMinutesHM(recipe.totalMinutes) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="border-border flex shrink-0 items-center gap-3 border-b px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:px-6 md:pt-5">
      {recipe.image && (
        <FallbackImage
          alt=""
          className="size-11 shrink-0 rounded-xl object-cover"
          src={addBasePathToUrl(recipe.image)}
          variant="hero"
        />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold md:text-lg">{recipe.name}</h2>
        {subtitle && <p className="text-muted truncate text-xs">{subtitle}</p>}
      </div>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          aria-label={tCommon("close")}
          className="size-10 min-w-10 shrink-0 rounded-full"
          variant="tertiary"
          onPress={onClose}
        >
          <XMarkIcon className="size-5" />
        </Button>
        <Tooltip.Content placement="bottom">{tCommon("close")}</Tooltip.Content>
      </Tooltip>
    </header>
  );
}
