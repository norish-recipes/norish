"use client";

import dynamic from "next/dynamic";
import { SettingsTabSkeleton } from "@/components/skeleton/settings-skeleton";

import type { SettingsShape } from "../settings-tab";
import { SettingsTabs } from "./settings-tabs";

const UserSettingsTab = dynamic(() => import("../user/components/user-settings-content"), {
  loading: () => <SettingsTabSkeleton tab="user" />,
});

const HouseholdSettingsTab = dynamic(
  () => import("../household/components/household-settings-content"),
  {
    loading: () => <SettingsTabSkeleton tab="household" />,
  }
);

const CalDavSettingsTab = dynamic(() => import("../caldav/components/caldav-settings-content"), {
  loading: () => <SettingsTabSkeleton tab="caldav" />,
});

const IngredientsSettingsTab = dynamic(
  () => import("../ingredients/components/ingredients-settings-content"),
  {
    loading: () => <SettingsTabSkeleton tab="ingredients" />,
  }
);

const EquipmentSettingsTab = dynamic(
  () => import("../equipment/components/equipment-settings-content"),
  {
    loading: () => <SettingsTabSkeleton tab="equipment" />,
  }
);

const AdminSettingsTab = dynamic(() => import("../admin/components/admin-settings-content"), {
  loading: () => <SettingsTabSkeleton tab="admin" />,
});

export default function SettingsPageContent({ shape }: { shape: SettingsShape }) {
  return (
    <SettingsTabs
      panel={(tab) =>
        ({
          user: <UserSettingsTab />,
          household: <HouseholdSettingsTab />,
          caldav: <CalDavSettingsTab />,
          ingredients: <IngredientsSettingsTab />,
          equipment: <EquipmentSettingsTab />,
          admin: <AdminSettingsTab />,
        })[tab]
      }
      shape={shape}
    />
  );
}
