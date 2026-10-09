"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import SettingsPageSkeleton from "@/components/skeleton/settings-page-skeleton";
import SettingsSkeleton from "@/components/skeleton/settings-skeleton";
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

const UserSettingsTab = dynamic(() => import("../user/components/user-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

const HouseholdSettingsTab = dynamic(
  () => import("../household/components/household-settings-content"),
  {
    loading: () => <SettingsSkeleton />,
  }
);

const CalDavSettingsTab = dynamic(() => import("../caldav/components/caldav-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

const IngredientsSettingsTab = dynamic(
  () => import("../ingredients/components/ingredients-settings-content"),
  {
    loading: () => <SettingsSkeleton />,
  }
);

const AdminSettingsTab = dynamic(() => import("../admin/components/admin-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

function SettingsContent({ showAdminTab }: { showAdminTab: boolean }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "user";
  const currentTab =
    requestedTab === "user" ||
    requestedTab === "household" ||
    requestedTab === "caldav" ||
    requestedTab === "ingredients" ||
    (requestedTab === "admin" && showAdminTab)
      ? requestedTab
      : "user";
  const tabs = [
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
    ...(showAdminTab
      ? [
          {
            id: "admin",
            label: t("tabs.admin"),
            activeIcon: ShieldCheckIconSolid,
            inactiveIcon: ShieldCheckIconOutline,
          },
        ]
      : []),
  ];

  const handleTabChange = (key: React.Key) => {
    router.push(`/settings?tab=${String(key)}`);
  };

  return (
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
                    <span className={isCurrent ? undefined : "hidden sm:inline"}>{tab.label}</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="user" className="px-0 py-4">
          <UserSettingsTab />
        </Tabs.Panel>

        <Tabs.Panel id="household" className="px-0 py-4">
          <HouseholdSettingsTab />
        </Tabs.Panel>

        <Tabs.Panel id="caldav" className="px-0 py-4">
          <CalDavSettingsTab />
        </Tabs.Panel>

        <Tabs.Panel id="ingredients" className="px-0 py-4">
          <IngredientsSettingsTab />
        </Tabs.Panel>

        {showAdminTab ? (
          <Tabs.Panel id="admin" className="px-0 py-4">
            <AdminSettingsTab />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function SettingsPageContent({ showAdminTab }: { showAdminTab: boolean }) {
  // Same skeleton as the route's loading.tsx. `useSearchParams` suspends this
  // boundary during streaming SSR, and a bare text fallback there would paint a
  // chrome-less frame — the exact state loading.tsx was changed to stop showing.
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsContent showAdminTab={showAdminTab} />
    </Suspense>
  );
}
