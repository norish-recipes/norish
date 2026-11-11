"use client";

import type { SettingsTab } from "@/components/settings/settings-tab";
import type { ReactNode } from "react";
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

/** The settings tab bar, the current tab taken from the address, over that tab's panel. */
export function SettingsTabs({
  showAdminTab,
  children,
}: {
  showAdminTab: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const tabs = SETTINGS_TABS.filter((tab) => showAdminTab || tab !== "admin");
  const currentTab = settingsTabOf(pathname);

  return (
    <Tabs aria-label={t("page.ariaLabel")} className="w-full" selectedKey={currentTab}>
      {/* A tab with an `href` renders a link; this provider sends only the tab bar's links through
          Next's client router, skipping the open tab's own address (React Aria navigates first). */}
      <RouterProvider
        navigate={(href, options) => {
          if (href !== pathname) router.push(href, options);
        }}
        useHref={addBasePath}
      >
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
      </RouterProvider>
      <Tabs.Panel className="px-0 py-4" id={currentTab}>
        {children}
      </Tabs.Panel>
    </Tabs>
  );
}
