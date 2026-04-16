"use client";

import SettingsSkeleton from "@/components/skeleton/settings-skeleton";

import { AdminSettingsProvider, useAdminSettingsContext } from "../context";
import AIProcessingCard from "./ai-processing-card";
import { AuthProvidersCard } from "./auth-providers";
import ContentDetectionCard from "./content-detection-card";
import GeneralCard from "./general-card";
import PermissionPolicyCard from "./permission-policy-card";
import AdminShareLinksCard from "./share-links-card";
import SystemCard from "./system-card";

function AdminSettingsContent() {
  const { isLoading } = useAdminSettingsContext();

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <GeneralCard />
      <PermissionPolicyCard />
      <AdminShareLinksCard />
      <AuthProvidersCard />
      <ContentDetectionCard />
      <AIProcessingCard />
      <SystemCard />
    </div>
  );
}

export default function AdminSettingsContentWrapper() {
  return (
    <AdminSettingsProvider>
      <AdminSettingsContent />
    </AdminSettingsProvider>
  );
}
