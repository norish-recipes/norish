"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { BookmarkSquareIcon, BookOpenIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

/** The Recipes or Cookbooks lens with nothing in it yet. */
export default function LibraryEmpty({ cookbooks }: { cookbooks: boolean }) {
  const t = useTranslations("recipes.empty");

  return (
    <EmptyState
      icon={cookbooks ? BookmarkSquareIcon : BookOpenIcon}
      title={cookbooks ? t("noCookbooks") : t("title")}
      variant="page"
    />
  );
}
