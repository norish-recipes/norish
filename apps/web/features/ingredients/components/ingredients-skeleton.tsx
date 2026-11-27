"use client";

import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { ActionButton } from "@/components/shared/action-button";
import { ListFrame } from "@/components/shared/list-row";
import { SearchField } from "@/components/shared/search-field";
import { BookOpenIcon, CircleStackIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { IngredientFiltersButton } from "./ingredient-filters-button";
import { IngredientRowSkeleton } from "./ingredient-row";

/** The rows of the Ingredients list while they load, in the list's own frame. */
export function IngredientRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-busy data-testid="ingredients-loading">
      <ListFrame>
        {Array.from({ length: count }, (_, row) => (
          <IngredientRowSkeleton key={row} />
        ))}
      </ListFrame>
    </div>
  );
}

/** The Ingredients list while it loads: its card with the search, the rows, and the Data sources card. */
export function IngredientsSkeleton() {
  const t = useTranslations("settings.ingredients");
  const tActions = useTranslations("common.actions");

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard
        actions={
          <ActionButton action="add" isDisabled>
            {tActions("add")}
          </ActionButton>
        }
        icon={BookOpenIcon}
        title={t("title")}
      >
        <SearchField
          isDisabled
          label={t("search")}
          suffix={<IngredientFiltersButton isDisabled />}
          value=""
          onChange={() => undefined}
        />
        <IngredientRowsSkeleton />
      </SettingsCard>
      <SettingsCardsSkeleton
        cards={[{ icon: CircleStackIcon, section: "ingredients.dataSources", rows: 2 }]}
      />
    </div>
  );
}
