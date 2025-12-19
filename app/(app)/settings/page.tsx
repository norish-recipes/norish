"use client";

import { Tabs, Tab } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCircleIcon, HomeIcon, ServerIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Suspense } from "react";
import dynamic from "next/dynamic";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "user";
  const { isServerAdmin, isLoading: isLoadingRole } = useUserRoleQuery();

  const handleTabChange = (key: React.Key) => {
    router.push(`/settings?tab=${key}`);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Tabs
        aria-label="Settings tabs"
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
              <UserCircleIcon className="h-5 w-5" />
              <span>User</span>
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
              <HomeIcon className="h-5 w-5" />
              <span>Household</span>
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
              <ServerIcon className="h-5 w-5" />
              <span>CalDAV</span>
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
                <ShieldCheckIcon className="h-5 w-5" />
                <span>Admin</span>
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
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
