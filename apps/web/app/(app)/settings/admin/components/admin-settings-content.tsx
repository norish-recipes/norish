"use client";

import { useAdminConfigsLoading } from "@norish/shared-react/admin";

import AdminSkeleton from "./admin-skeleton";
import AIProcessingCard from "./ai-processing-card";
import { AuthProvidersCard } from "./auth-providers";
import ContentDetectionCard from "./content-detection-card";
import GeneralCard from "./general-card";
import JobQueueCard from "./job-queue-card";
import PageRenderersCard from "./page-renderers-card";
import PermissionPolicyCard from "./permission-policy-card";
import AdminShareLinksCard from "./share-links-card";
import SystemCard from "./system-card";
import UsersCard from "./users-card";

export default function AdminSettingsContent() {
  const isLoading = useAdminConfigsLoading();

  if (isLoading) {
    return <AdminSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <GeneralCard />
      <UsersCard />
      <PermissionPolicyCard />
      <AdminShareLinksCard />
      <AuthProvidersCard />
      <ContentDetectionCard />
      <PageRenderersCard />
      <AIProcessingCard />
      <JobQueueCard />
      <SystemCard />
    </div>
  );
}
