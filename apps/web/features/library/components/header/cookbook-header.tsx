"use client";

import type { ReactNode } from "react";
import { BackLink } from "@/components/page-transition";
import { useBackDestination } from "@/hooks/use-back-destination";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookQueryResult } from "@norish/shared-react/recipes";
import { useLibraryFilters } from "@norish/shared-react/recipes";

import RecipeViewModeToggle from "./recipe-view-mode-toggle";
import SearchInput from "./search-input";

export const COOKBOOK_HEADING_ID = "cookbook-heading";

/**
 * The page's header: the way back, the title over its count, the view toggle
 * and the cookbook's actions, and the search. Grey until the cookbook is read.
 */
export default function CookbookHeader({
  cookbook,
  actions,
}: {
  cookbook?: CookbookQueryResult["cookbook"];
  actions?: ReactNode;
}) {
  const t = useTranslations("recipes.cookbooks");
  const libraryType = useLibraryFilters((state) => state.filters.libraryType);
  const back = useBackDestination(libraryType);

  return (
    <div className="flex shrink-0 flex-col gap-4">
      {/* A cookbook is reached from the Library and from a recipe that is
          in it, so the way back names wherever that was. */}
      <div className="w-fit">
        <BackLink
          className="text-muted hover:text-foreground flex items-center gap-1 text-base no-underline"
          href={back.href}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {cookbook ? back.label : <Skeleton className="my-1 h-4 w-28 rounded-md" />}
        </BackLink>
      </div>

      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        {/* The count under the title, as Today's date sits under Today, so a
            long title keeps the row instead of giving way to it */}
        {cookbook ? (
          <div className="min-w-0">
            <h1
              className="text-foreground text-2xl leading-8 font-semibold break-words"
              id={COOKBOOK_HEADING_ID}
            >
              {cookbook.title}
            </h1>
            <p className="text-muted mt-1 text-sm">
              {t("recipeCount", { count: cookbook.memberCount })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-1">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <RecipeViewModeToggle />
          {actions}
        </div>
      </div>

      <div className="min-w-0">
        <SearchInput />
      </div>
    </div>
  );
}
