"use client";

import { useSearchParams } from "next/navigation";
import { cookbookIdFromPath, recipeIdFromPath, safeOrigin } from "@/lib/back-destination";
import { useTranslations } from "next-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import { useCookbookQuery, useHeldRecipeName } from "@norish/shared-react/recipes";

export type BackDestination = { href: string; label: string };

/**
 * The way back from a page that can be reached from several places.
 *
 * "Back to recipes" was a guess that happened to be right on the Library and
 * wrong everywhere else — a recipe opened from inside a cookbook offered to
 * take the reader somewhere they had not been. The origin travels in the URL,
 * so this resolves it to a real destination and names it.
 *
 * With no origin the answer is the Library, named by `libraryType`, the lens the
 * reader left lit: that is genuinely where "/" lands them, so the label is not a guess.
 */
export function useBackDestination(libraryType: LibraryTypeFilter): BackDestination {
  const t = useTranslations("recipes.back");
  const from = safeOrigin(useSearchParams().get("from"));

  const cookbookId = cookbookIdFromPath(from);
  const recipeId = recipeIdFromPath(from);

  // Enabled only when the origin is a cookbook. Coming from one means its row
  // is already cached, so this normally answers without a request.
  const { cookbook } = useCookbookQuery(cookbookId ?? "", { enabled: Boolean(cookbookId) });

  // A reader who came from a recipe has it cached.
  const recipeName = useHeldRecipeName(recipeId);

  if (cookbookId) {
    return {
      href: from!,
      label: cookbook ? t("named", { name: cookbook.title }) : t("cookbook"),
    };
  }

  if (recipeId) {
    return {
      href: from!,
      label: recipeName ? t("named", { name: recipeName }) : t("generic"),
    };
  }

  if (from && from !== "/") {
    return { href: from, label: t("generic") };
  }

  // Named by the lens rather than by the page, because that is what "/" shows.
  return { href: "/", label: t(libraryType) };
}
