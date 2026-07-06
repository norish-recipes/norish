"use client";

import { BookOpenIcon, ListBulletIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { Button, Tabs, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookingModeTab } from "./types";

type CookingModeHeaderProps = {
  activeTab: CookingModeTab;
  recipeName: string;
  onClose: () => void;
  onTabChange: (tab: CookingModeTab) => void;
};

export function CookingModeHeader({
  activeTab,
  recipeName,
  onClose,
  onTabChange,
}: CookingModeHeaderProps) {
  const tDetail = useTranslations("recipes.detail");
  const tCookMode = useTranslations("recipes.cookMode");
  const tCommon = useTranslations("common.actions");

  return (
    <header className="border-border flex shrink-0 flex-col gap-3 border-b px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:border-b-0 md:px-6 md:pt-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted text-xs font-semibold">{tDetail("cook")}</p>
          <h2 className="truncate text-lg font-semibold md:text-xl">{recipeName}</h2>
        </div>
        <Tooltip delay={0}>
          <Button
            isIconOnly
            aria-label={tCommon("close")}
            className="size-10 min-w-10 rounded-full"
            variant="tertiary"
            onPress={onClose}
          >
            <XMarkIcon className="size-5" />
          </Button>
          <Tooltip.Content placement="bottom">{tCommon("close")}</Tooltip.Content>
        </Tooltip>
      </div>

      <Tabs.ListContainer>
        <Tabs.List aria-label={tDetail("cook")} className="w-full">
          <Tabs.Tab className="flex-1" id="steps">
            <ListBulletIcon className="size-4" />
            {tCookMode("steps")}
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab className="flex-1" id="ingredients">
            <BookOpenIcon className="size-4" />
            {tCookMode("ingredients")}
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </header>
  );
}
