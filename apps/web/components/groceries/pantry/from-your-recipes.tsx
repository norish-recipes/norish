"use client";

import type { PickedFood } from "@/hooks/pantry";
import { useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { IngredientIcon, IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { IconActionButton } from "@/components/shared/action-button";
import { useSpellingRules } from "@/hooks/config";
import { usePantrySuggestions } from "@/hooks/pantry";
import { ChevronRightIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

/** How many suggestions show before Show more. */
const HANDFUL = 6;

/**
 * "From your recipes": the foods the household's own recipes use most, each
 * with how many use it and one tap to keep it. It opens when the Pantry was
 * empty as the page loaded and is folded otherwise, and keeps whatever state
 * the reader leaves it in for the visit; nothing is stored. A food the
 * Pantry covers leaves at once, by the same coverage rule the server used.
 * Best-effort: absent offline, or when there is nothing to offer.
 */
export function FromYourRecipes({
  items,
  onKeep,
}: {
  items: readonly PantryIngredientDto[];
  onKeep: (food: PickedFood) => void;
}) {
  const t = useTranslations("groceries.pantry");
  const locale = useLocale();
  const rules = useSpellingRules();
  const { isOffline } = useConnectivity();
  const { suggestions } = usePantrySuggestions(!isOffline);
  // Mounted once the Pantry has answered, so this is the Pantry on load.
  const [open, setOpen] = useState(items.length === 0);
  const [showAll, setShowAll] = useState(false);
  const offered = suggestions.filter(
    (food) =>
      pantryIngredientFor(
        items,
        { ingredientId: food.ingredientId, ingredientName: food.name },
        rules
      ) === null
  );

  if (offered.length === 0) return null;

  const shown = showAll ? offered : offered.slice(0, HANDFUL);

  return (
    <section className="flex flex-col gap-2" data-testid="pantry-suggestions">
      <button
        aria-expanded={open}
        className="text-muted hover:text-foreground flex w-fit cursor-[var(--cursor-interactive)] items-center gap-1 text-xs font-semibold tracking-wide uppercase"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <ChevronRightIcon className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} />
        {t("fromYourRecipes")}
      </button>
      {open ? (
        <>
          <p className="text-muted text-sm">{t("fromYourRecipesHint")}</p>
          <IngredientIconsProvider ids={shown.map((food) => food.ingredientId)}>
            <ul className="divide-border divide-y overflow-hidden rounded-lg">
              {shown.map((food) => {
                const name = ingredientDisplayName(food, locale);

                return (
                  <li
                    key={food.ingredientId}
                    className="bg-surface flex min-h-12 items-center gap-3 px-4 py-2"
                    data-pantry-suggestion={food.name}
                  >
                    <IngredientIcon ingredientId={food.ingredientId} />
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    <span className="text-muted shrink-0 text-xs">
                      {t("inRecipes", { count: food.recipeCount })}
                    </span>
                    <IconActionButton
                      action="add"
                      className="shrink-0"
                      label={t("addFood", { name })}
                      size="sm"
                      variant="tertiary"
                      onPress={() => onKeep(food)}
                    />
                  </li>
                );
              })}
            </ul>
          </IngredientIconsProvider>
          {!showAll && offered.length > HANDFUL ? (
            <Button className="w-fit" size="sm" variant="tertiary" onPress={() => setShowAll(true)}>
              {t("showMore")}
            </Button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
