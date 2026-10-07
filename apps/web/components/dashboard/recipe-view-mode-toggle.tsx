"use client";

import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/20/solid";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * The tab list for the library's grid/list switch. The `Tabs` root lives in
 * the dashboard so the panels it controls can sit below the search input.
 * As tall as the 40px buttons beside it, wherever it is used.
 */
export default function RecipeViewModeToggle() {
  const t = useTranslations("recipes.dashboard.viewMode");

  return (
    <Tabs.ListContainer className="shrink-0">
      <Tabs.List aria-label={t("label")} className="p-0.5">
        <Tabs.Tab className="h-9 min-w-10 px-2.5 text-sm sm:min-w-20" id="grid">
          <div className="flex items-center gap-1.5" title={t("grid")}>
            <Squares2X2Icon className="size-5 shrink-0" />
            <span className="sr-only sm:not-sr-only">{t("grid")}</span>
          </div>
          <Tabs.Indicator />
        </Tabs.Tab>
        <Tabs.Tab className="h-9 min-w-10 px-2.5 text-sm sm:min-w-20" id="list">
          <div className="flex items-center gap-1.5" title={t("list")}>
            <ListBulletIcon className="size-5 shrink-0" />
            <span className="sr-only sm:not-sr-only">{t("list")}</span>
          </div>
          <Tabs.Indicator />
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.ListContainer>
  );
}
