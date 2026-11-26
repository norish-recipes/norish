"use client";

import { EmptyStateCard } from "@/components/shared/empty-state";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

export default function NoRecipesText() {
  const t = useTranslations("recipes.empty");

  return (
    <div className="px-4 py-20">
      <EmptyStateCard className="mx-auto w-full max-w-xl" icon={BookOpenIcon} title={t("title")} />
    </div>
  );
}
