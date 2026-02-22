"use client";

import { AdminSettingsProvider, useAdminSettingsContext } from "../context";

import GeneralCard from "./general-card";
import { AuthProvidersCard } from "./auth-providers";
import ContentDetectionCard from "./content-detection-card";
import SystemCard from "./system-card";
import AIProcessingCard from "./ai-processing-card";
import PermissionPolicyCard from "./permission-policy-card";

import SettingsSkeleton from "@/components/skeleton/settings-skeleton";

function AdminSettingsContent() {
  const { isLoading } = useAdminSettingsContext();

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <GeneralCard />
      <PermissionPolicyCard />
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
