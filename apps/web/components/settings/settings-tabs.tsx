"use client";

import type { SettingsTab } from "@/components/settings/settings-tab";
import { usePathname, useRouter } from "next/navigation";
import { settingsHref, settingsTabOf } from "@/components/settings/settings-tab";
import {
  BookOpenIcon as BookOpenIconSolid,
  HomeIcon as HomeIconSolid,
  ServerIcon as ServerIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from "@heroicons/react/20/solid";
import {
  BookOpenIcon as BookOpenIconOutline,
  HomeIcon as HomeIconOutline,
  ServerIcon as ServerIconOutline,
  ShieldCheckIcon as ShieldCheckIconOutline,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";
import { RouterProvider } from "react-aria-components";

import { addBasePath } from "@norish/shared/lib/base-path";

/** The settings tab bar: one link per tab, the current one taken from the address. */
export function SettingsTabs({ showAdminTab }: { showAdminTab: boolean }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const tabs: Array<{
    id: SettingsTab;
    label: string;
    activeIcon: typeof UserCircleIconSolid;
    inactiveIcon: typeof UserCircleIconOutline;
  }> = [
    {
      id: "account",
      label: t("tabs.account"),
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
    ...(showAdminTab
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

  const currentTab = settingsTabOf(pathname);

  // A React Aria tab with an `href` renders a link; this sends it through Next's client router.
  return (
    <RouterProvider navigate={router.push} useHref={addBasePath}>
      <Tabs aria-label={t("page.ariaLabel")} className="w-full" selectedKey={currentTab}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("page.ariaLabel")}>
            {tabs.map((tab) => {
              const isCurrent = currentTab === tab.id;
              const Icon = isCurrent ? tab.activeIcon : tab.inactiveIcon;

              return (
                // Four or five labelled tabs are wider than a phone, so below `sm` only the
                // current tab shows its name; `aria-label` names the others.
                <Tabs.Tab
                  key={tab.id}
                  aria-label={tab.label}
                  className="h-12"
                  href={settingsHref(tab.id)}
                  id={tab.id}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={isCurrent ? undefined : "hidden sm:inline"}>{tab.label}</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </RouterProvider>
  );
}
