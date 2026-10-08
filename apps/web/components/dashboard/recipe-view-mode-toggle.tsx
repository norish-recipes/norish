"use client";

import type { ReactNode } from "react";
import { useDevicePreference } from "@/context/device-preferences-context";
import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/20/solid";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

import { RECIPE_VIEW_MODES } from "@norish/shared/contracts/zod/device-preferences";
import { cssHeaderIcon, cssHeaderTab } from "@norish/web/config/css-tokens";

/**
 * The `Tabs` root for the grid/list switch, bound to the reader's Device
 * Preference. The Library and a cookbook put their panels inside it.
 */
export function RecipeViewModeTabs({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useDevicePreference("recipeViewMode");

  return (
    <Tabs
      className="min-h-0 flex-1 gap-5"
      selectedKey={viewMode}
      onSelectionChange={(key) => {
        const mode = RECIPE_VIEW_MODES.find((option) => option === key);

        if (mode) setViewMode(mode);
      }}
    >
      {children}
    </Tabs>
  );
}

/**
 * The tab list for the grid/list switch. The `Tabs` root is
 * {@link RecipeViewModeTabs}, so the panels it controls can sit below the
 * search input.
 * As tall as the buttons beside it, wherever it is used.
 */
export default function RecipeViewModeToggle() {
  const t = useTranslations("recipes.dashboard.viewMode");

  return (
    <Tabs.ListContainer className="shrink-0">
      <Tabs.List aria-label={t("label")} className="p-0.5">
        <Tabs.Tab className={cssHeaderTab} id="grid">
          <div className="flex items-center gap-1.5" title={t("grid")}>
            <Squares2X2Icon className={cssHeaderIcon} />
            <span className="sr-only sm:not-sr-only">{t("grid")}</span>
          </div>
          <Tabs.Indicator />
        </Tabs.Tab>
        <Tabs.Tab className={cssHeaderTab} id="list">
          <div className="flex items-center gap-1.5" title={t("list")}>
            <ListBulletIcon className={cssHeaderIcon} />
            <span className="sr-only sm:not-sr-only">{t("list")}</span>
          </div>
          <Tabs.Indicator />
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.ListContainer>
  );
}
