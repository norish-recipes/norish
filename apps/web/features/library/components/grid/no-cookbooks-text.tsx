"use client";

import { EmptyStateCard } from "@/components/shared/empty-state";
import { BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

/** The Cookbooks lens with nothing in it yet. */
export default function NoCookbooksText() {
  const t = useTranslations("recipes.empty");

  return (
    <div className="px-4 py-20">
      <EmptyStateCard
        className="mx-auto w-full max-w-xl"
        icon={BookmarkSquareIcon}
        title={t("noCookbooks")}
      />
    </div>
  );
}
