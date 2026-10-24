"use client";

import type { ReactNode } from "react";
import { createContext } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpenIcon as BookOpenIconSolid,
  HomeIcon as HomeIconSolid,
  ServerIcon as ServerIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  WrenchScrewdriverIcon as WrenchScrewdriverIconSolid,
} from "@heroicons/react/20/solid";
import {
  BookOpenIcon as BookOpenIconOutline,
  HomeIcon as HomeIconOutline,
  ServerIcon as ServerIconOutline,
  ShieldCheckIcon as ShieldCheckIconOutline,
  UserCircleIcon as UserCircleIconOutline,
  WrenchScrewdriverIcon as WrenchScrewdriverIconOutline,
} from "@heroicons/react/24/outline";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { SettingsShape, SettingsTab } from "../settings-tab";
import { openSettingsTab } from "../settings-tab";

export const SettingsShapeContext = createContext<SettingsShape>({
  showAdminTab: false,
  household: "none",
  caldav: "none",
});

/**
 * The settings page's title and tab bar, with `panel` drawing the open tab. The
 * page and its skeleton both draw it, so loading only ever fills in the panel.
 */
export function SettingsTabs({
  shape,
  panel,
}: {
  shape: SettingsShape;
  panel: (tab: SettingsTab) => ReactNode;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabs: Array<{
    id: SettingsTab;
    label: string;
    activeIcon: typeof UserCircleIconSolid;
    inactiveIcon: typeof UserCircleIconOutline;
  }> = [
    {
      id: "user",
      label: t("tabs.user"),
      activeIcon: UserCircleIconSolid,
      inactiveIcon: UserCircleIconOutline,
    },
    {
      id: "household",
      label: t("tabs.household"),
      activeIcon: HomeIconSolid,
      inactiveIcon: HomeIconOutline,
    },
    {
      id: "caldav",
      label: t("tabs.caldav"),
      activeIcon: ServerIconSolid,
      inactiveIcon: ServerIconOutline,
    },
    {
      id: "ingredients",
      label: t("tabs.ingredients"),
      activeIcon: BookOpenIconSolid,
      inactiveIcon: BookOpenIconOutline,
    },
    {
      id: "equipment",
      label: t("tabs.equipment"),
      activeIcon: WrenchScrewdriverIconSolid,
      inactiveIcon: WrenchScrewdriverIconOutline,
    },
    ...(shape.showAdminTab
      ? [
          {
            id: "admin" as const,
            label: t("tabs.admin"),
            activeIcon: ShieldCheckIconSolid,
            inactiveIcon: ShieldCheckIconOutline,
          },
        ]
      : []),
  ];

  const currentTab = openSettingsTab(searchParams.get("tab"), shape);

  const handleTabChange = (key: React.Key) => {
    router.push(`/settings?tab=${String(key)}`);
  };

  return (
    <SettingsShapeContext value={shape}>
      <div className="flex w-full flex-col gap-6">
        <h1 className="text-2xl font-bold">{t("page.title")}</h1>

        <Tabs
          aria-label={t("page.ariaLabel")}
          className="w-full"
          selectedKey={currentTab}
          onSelectionChange={handleTabChange}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label={t("page.ariaLabel")}>
              {tabs.map((tab) => {
                const isCurrent = currentTab === tab.id;
                const Icon = isCurrent ? tab.activeIcon : tab.inactiveIcon;

                return (
                  // Four or five labelled tabs are wider than a phone, which left the
                  // last one — Admin, for the readers who have it — scrolled off
                  // the end of a strip that gives no sign it scrolls. Below `sm`
                  // only the tab you are on says its name; `aria-label` keeps the
                  // others named for anyone not reading the icons.
                  <Tabs.Tab key={tab.id} aria-label={tab.label} className="h-12" id={tab.id}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className={isCurrent ? undefined : "hidden sm:inline"}>
                        {tab.label}
                      </span>
                    </div>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs.ListContainer>

          {tabs.map((tab) => (
            <Tabs.Panel key={tab.id} className="px-0 py-4" id={tab.id}>
              {panel(tab.id)}
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>
    </SettingsShapeContext>
  );
}
