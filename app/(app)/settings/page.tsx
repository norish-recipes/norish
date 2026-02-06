"use client";

import { Tabs, Tab } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserCircleIcon as UserCircleIconSolid,
  HomeIcon as HomeIconSolid,
  ServerIcon as ServerIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
} from "@heroicons/react/20/solid";
import {
  UserCircleIcon as UserCircleIconOutline,
  HomeIcon as HomeIconOutline,
  ServerIcon as ServerIconOutline,
  ShieldCheckIcon as ShieldCheckIconOutline,
} from "@heroicons/react/24/outline";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import SettingsSkeleton from "@/components/skeleton/settings-skeleton";
import { useUserRoleQuery } from "@/hooks/admin";

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
  const currentTab = searchParams.get("tab") || "user";
  const { isServerAdmin, isLoading: isLoadingRole } = useUserRoleQuery();

  const handleTabChange = (key: React.Key) => {
    router.push(`/settings?tab=${key}`);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("page.title")}</h1>

      <Tabs
        aria-label={t("page.ariaLabel")}
        classNames={{
          tabList: "overflow-x-auto",
          tab: "h-12",
        }}
        selectedKey={currentTab}
        onSelectionChange={handleTabChange}
      >
        <Tab
          key="user"
          title={
            <div className="flex items-center gap-2">
              {currentTab === "user" ? (
                <UserCircleIconSolid className="h-5 w-5" />
              ) : (
                <UserCircleIconOutline className="h-5 w-5" />
              )}
              <span>{t("tabs.user")}</span>
            </div>
          }
        >
          <div className="py-4">
            <UserSettingsTab />
          </div>
        </Tab>

        <Tab
          key="household"
          title={
            <div className="flex items-center gap-2">
              {currentTab === "household" ? (
                <HomeIconSolid className="h-5 w-5" />
              ) : (
                <HomeIconOutline className="h-5 w-5" />
              )}
              <span>{t("tabs.household")}</span>
            </div>
          }
        >
          <div className="py-4">
            <HouseholdSettingsTab />
          </div>
        </Tab>

        <Tab
          key="caldav"
          title={
            <div className="flex items-center gap-2">
              {currentTab === "caldav" ? (
                <ServerIconSolid className="h-5 w-5" />
              ) : (
                <ServerIconOutline className="h-5 w-5" />
              )}
              <span>{t("tabs.caldav")}</span>
            </div>
          }
        >
          <div className="py-4">
            <CalDavSettingsTab />
          </div>
        </Tab>

        {/* Admin tab - only visible to server admins */}
        {!isLoadingRole && isServerAdmin && (
          <Tab
            key="admin"
            title={
              <div className="flex items-center gap-2">
                {currentTab === "admin" ? (
                  <ShieldCheckIconSolid className="h-5 w-5" />
                ) : (
                  <ShieldCheckIconOutline className="h-5 w-5" />
                )}
                <span>{t("tabs.admin")}</span>
              </div>
            }
          >
            <div className="py-4">
              <AdminSettingsTab />
            </div>
          </Tab>
        )}
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
