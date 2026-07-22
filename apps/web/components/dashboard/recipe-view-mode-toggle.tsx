"use client";

import type { RecipeDashboardViewMode } from "@/hooks/use-recipe-dashboard-view-mode";
import type { Key } from "react";
import { Segment } from "@/components/ui/segment";
import { useRecipeDashboardViewMode } from "@/hooks/use-recipe-dashboard-view-mode";
import { ListBulletIcon, Squares2X2Icon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";

function toRecipeDashboardViewMode(key: Key): RecipeDashboardViewMode {
  return key === "list" ? "list" : "grid";
}

export default function RecipeViewModeToggle() {
  const t = useTranslations("recipes.dashboard.viewMode");
  const [viewMode, setViewMode] = useRecipeDashboardViewMode();

  return (
    <Segment
      aria-label={t("label")}
      className="shrink-0"
      selectedKey={viewMode}
      size="sm"
      onSelectionChange={(key) => setViewMode(toRecipeDashboardViewMode(key))}
    >
      <Segment.Item
        aria-label={t("grid")}
        className="min-w-8 px-2.5 sm:min-w-16"
        id="grid"
        title={t("grid")}
      >
        <Segment.Separator />
        <Squares2X2Icon className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">{t("grid")}</span>
      </Segment.Item>
      <Segment.Item
        aria-label={t("list")}
        className="min-w-8 px-2.5 sm:min-w-16"
        id="list"
        title={t("list")}
      >
        <Segment.Separator />
        <ListBulletIcon className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">{t("list")}</span>
      </Segment.Item>
    </Segment>
  );
}
