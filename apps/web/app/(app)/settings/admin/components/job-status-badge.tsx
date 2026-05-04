"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

type JobStatus = "queued" | "active" | "completed" | "failed";

const statusColorMap: Record<JobStatus, "default" | "primary" | "success" | "danger"> = {
  queued: "default",
  active: "primary",
  completed: "success",
  failed: "danger",
};

export function JobStatusBadge({ status }: { status: string }) {
  const t = useTranslations("settings.admin.jobs.status");
  const color = statusColorMap[status as JobStatus] ?? "default";

  return (
    <Chip color={color} size="sm" variant="flat">
      {t(status as any)}
    </Chip>
  );
}
