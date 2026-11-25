"use client";

import { useAdminConfigsLoading } from "@norish/shared-react/admin";

import AdminSkeleton from "./components/admin-skeleton";
import AIProcessingCard from "./components/ai/ai-processing-card";
import { AuthProvidersCard } from "./components/auth-providers/auth-providers-card";
import ContentDetectionCard from "./components/content-detection/content-detection-card";
import GeneralCard from "./components/general/general-card";
import JobQueueCard from "./components/jobs/job-queue-card";
import PageRenderersCard from "./components/page-renderers/page-renderers-card";
import PermissionPolicyCard from "./components/permissions/permission-policy-card";
import AdminShareLinksCard from "./components/share-links-card";
import SystemCard from "./components/system/system-card";
import UsersCard from "./components/users/users-card";

export function AdminScreen() {
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
