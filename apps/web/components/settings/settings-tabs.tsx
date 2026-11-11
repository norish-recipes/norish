"use client";

import type { SettingsTab } from "@/components/settings/settings-tab";
import { usePathname, useRouter } from "next/navigation";
import { SETTINGS_TABS, settingsHref, settingsTabOf } from "@/components/settings/settings-tab";
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

type TabIcon = typeof UserCircleIconSolid;

const TAB_ICONS: Record<SettingsTab, { active: TabIcon; inactive: TabIcon }> = {
  account: { active: UserCircleIconSolid, inactive: UserCircleIconOutline },
  household: { active: HomeIconSolid, inactive: HomeIconOutline },
  caldav: { active: ServerIconSolid, inactive: ServerIconOutline },
  ingredients: { active: BookOpenIconSolid, inactive: BookOpenIconOutline },
  admin: { active: ShieldCheckIconSolid, inactive: ShieldCheckIconOutline },
};

/** The settings tab bar: one link per tab, the current one taken from the address. */
export function SettingsTabs({ showAdminTab }: { showAdminTab: boolean }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const tabs = SETTINGS_TABS.filter((tab) => showAdminTab || tab !== "admin");
  const currentTab = settingsTabOf(pathname);

  // A React Aria tab with an `href` renders a link; this sends it through Next's client router.
  return (
    <RouterProvider navigate={router.push} useHref={addBasePath}>
      <Tabs aria-label={t("page.ariaLabel")} className="w-full" selectedKey={currentTab}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("page.ariaLabel")}>
            {tabs.map((tab) => {
              const isCurrent = currentTab === tab;
              const Icon = isCurrent ? TAB_ICONS[tab].active : TAB_ICONS[tab].inactive;
              const label = t(`tabs.${tab}`);

              return (
                // Four or five labelled tabs are wider than a phone, so below `sm` only the
                // current tab shows its name; `aria-label` names the others.
                <Tabs.Tab
                  key={tab}
                  aria-label={label}
                  className="h-12"
                  href={settingsHref(tab)}
                  id={tab}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={isCurrent ? undefined : "hidden sm:inline"}>{label}</span>
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
