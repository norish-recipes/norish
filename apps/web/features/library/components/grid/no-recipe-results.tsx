"use client";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

interface NoRecipeResultsProps {
  onClear: () => void;
}
export default function NoRecipeResults({ onClear }: NoRecipeResultsProps) {
  const t = useTranslations("recipes.empty");
  const tCommon = useTranslations("common.filters");

  return (
    <EmptyState
      action={
        <ActionButton action="dismiss" onPress={onClear}>
          {tCommon("clearFilters")}
        </ActionButton>
      }
      variant="page"
      icon={FunnelIcon}
      title={t("noResults")}
    />
  );
}
