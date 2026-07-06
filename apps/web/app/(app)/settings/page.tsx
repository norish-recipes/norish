"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import SettingsSkeleton from "@/components/skeleton/settings-skeleton";
import { useUserRoleQuery } from "@/hooks/admin";
import {
  HomeIcon as HomeIconSolid,
  ServerIcon as ServerIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from "@heroicons/react/20/solid";
import {
  HomeIcon as HomeIconOutline,
  ServerIcon as ServerIconOutline,
  ShieldCheckIcon as ShieldCheckIconOutline,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

const UserSettingsTab = dynamic(() => import("./user/components/user-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

const HouseholdSettingsTab = dynamic(
  () => import("./household/components/household-settings-content"),
  {
    loading: () => <SettingsSkeleton />,
  }
);

const CalDavSettingsTab = dynamic(() => import("./caldav/components/caldav-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

const AdminSettingsTab = dynamic(() => import("./admin/components/admin-settings-content"), {
  loading: () => <SettingsSkeleton />,
});

function SettingsContent() {
  const t = useTranslations("settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isServerAdmin, isLoading: isLoadingRole } = useUserRoleQuery();
  const showAdminTab = !isLoadingRole && isServerAdmin;
  const requestedTab = searchParams.get("tab") || "user";
  const currentTab =
    requestedTab === "user" ||
    requestedTab === "household" ||
    requestedTab === "caldav" ||
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
        <Tabs.ListContainer className="overflow-x-auto">
          <Tabs.List aria-label={t("page.ariaLabel")} className="w-max">
            {tabs.map((tab) => {
              const Icon = currentTab === tab.id ? tab.activeIcon : tab.inactiveIcon;

              return (
                <Tabs.Tab key={tab.id} id={tab.id} className="h-12">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="user" className="py-4">
          <UserSettingsTab />
        </Tabs.Panel>

        <Tabs.Panel id="household" className="py-4">
          <HouseholdSettingsTab />
        </Tabs.Panel>

        <Tabs.Panel id="caldav" className="py-4">
          <CalDavSettingsTab />
        </Tabs.Panel>

        {showAdminTab ? (
          <Tabs.Panel id="admin" className="py-4">
            <AdminSettingsTab />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <Suspense fallback={<div>{t("page.loading")}</div>}>
      <SettingsContent />
    </Suspense>
  );
}
