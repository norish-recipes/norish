"use client";

import { useSearchParams } from "next/navigation";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useOptionalRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useCookbookQuery } from "@/hooks/cookbooks";
import { cookbookIdFromPath, recipeIdFromPath, safeOrigin } from "@/lib/back-destination";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export type BackDestination = { href: string; label: string };

/**
 * The way back from a page that can be reached from several places.
 *
 * "Back to recipes" was a guess that happened to be right on the Library and
 * wrong everywhere else — a recipe opened from inside a cookbook offered to
 * take the reader somewhere they had not been. The origin travels in the URL,
 * so this resolves it to a real destination and names it.
 *
 * With no origin the answer is the Library, named by the lens the reader left
 * lit: that is genuinely where "/" lands them, so the label is not a guess.
 */
export function useBackDestination(): BackDestination {
  const t = useTranslations("recipes.back");
  // Optional: a recipe page is not a filtered list, and naming the Library
  // is not a reason to require being inside it.
  const filters = useOptionalRecipesFiltersContext()?.filters;
  const trpc = useTRPC();
  const from = safeOrigin(useSearchParams().get("from"));

  const cookbookId = cookbookIdFromPath(from);
  const recipeId = recipeIdFromPath(from);

  // Enabled only when the origin is a cookbook. Coming from one means its row
  // is already cached, so this normally answers without a request.
  const { cookbook } = useCookbookQuery(cookbookId ?? "", { enabled: Boolean(cookbookId) });

  // The recipe is read from the cache alone — a name for a back link is not
  // worth a request, and a reader who came from a recipe has it cached.
  const { data: recipe } = useQuery({
    ...trpc.recipes.get.queryOptions({ id: recipeId ?? "" }),
    enabled: false,
  });

  if (cookbookId) {
    return {
      href: from!,
      label: cookbook ? t("named", { name: cookbook.title }) : t("cookbook"),
    };
  }

  if (recipeId) {
    return {
      href: from!,
      label: recipe?.name ? t("named", { name: recipe.name }) : t("generic"),
    };
  }

  if (from && from !== "/") {
    return { href: from, label: t("generic") };
  }

  // Named by the lens rather than by the page, because that is what "/" shows.
  return { href: "/", label: t(filters?.libraryType ?? "all") };
}
