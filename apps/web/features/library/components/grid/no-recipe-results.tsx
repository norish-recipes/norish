"use client";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyStateCard } from "@/components/shared/empty-state";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

interface NoRecipeResultsProps {
  onClear: () => void;
}
export default function NoRecipeResults({ onClear }: NoRecipeResultsProps) {
  const t = useTranslations("recipes.empty");
  const tCommon = useTranslations("common.filters");

  return (
    <div className="px-4 py-16">
      <EmptyStateCard
        action={
          <ActionButton action="dismiss" onPress={onClear}>
            {tCommon("clearFilters")}
          </ActionButton>
        }
        className="mx-auto w-full max-w-2xl"
        icon={FunnelIcon}
        title={t("noResults")}
      />
    </div>
  );
}
