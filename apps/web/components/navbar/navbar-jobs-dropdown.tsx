"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJobsListQuery, useJobStatsQuery } from "@/hooks/admin/use-jobs-query";
import { useUserRoleQuery } from "@/hooks/admin";
import { QueueListIcon } from "@heroicons/react/16/solid";
import {
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Spinner,
  Divider,
  Chip,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import JobDetailModal from "@/app/(app)/settings/admin/components/job-detail-modal";

export default function NavbarJobsDropdown() {
  const { isServerAdmin, isLoading: roleLoading } = useUserRoleQuery();
  const tJobs = useTranslations("navbar.jobs");
  const tStatus = useTranslations("settings.admin.jobs.status");
  const tQueues = useTranslations("settings.admin.jobs.queues");

  const [isOpen, setIsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const router = useRouter();

  const { jobs, isLoading } = useJobsListQuery({
    limit: 6,
    offset: 0,
  });

  const { stats } = useJobStatsQuery();
  const activeCount = (stats.byStatus.active ?? 0) + (stats.byStatus.queued ?? 0);

  // Don't render for non-admins
  if (roleLoading || !isServerAdmin) return null;

  return (
    <>
      <Popover
        isOpen={isOpen}
        placement="bottom-end"
        onOpenChange={setIsOpen}
      >
        <PopoverTrigger>
          <button
            aria-label={tJobs("title")}
            className="relative rounded-full p-2 transition-colors hover:bg-default-100"
            type="button"
          >
            <Badge
              color="primary"
              content={activeCount}
              isInvisible={activeCount === 0}
              shape="circle"
              size="sm"
            >
              <QueueListIcon className="text-foreground/70 h-5 w-5" />
            </Badge>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-[340px] p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-default-400">
              {tJobs("title")}
            </span>
            {activeCount > 0 && (
              <Chip color="primary" size="sm" variant="flat">
                {tJobs("active", { count: activeCount })}
              </Chip>
            )}
          </div>

          <Divider />

          {/* Job list */}
          <div className="max-h-[320px] w-full overflow-y-auto overflow-x-hidden">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : jobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-default-400">
                {tJobs("empty")}
              </p>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-default-50 min-w-0"
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedJobId(job.id);
                  }}
                >
                  {/* Progress circle */}
                  <JobMiniCircle steps={job.steps as StepInfo[] | null} status={job.status} />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {job.description || job.jobId}
                    </span>
                    <span className="text-[11px] text-default-400">
                      {tQueues(job.queueName as any)}
                    </span>
                  </div>

                  {/* Status badge */}
                  <JobMiniBadge status={job.status} label={tStatus(job.status as any)} />
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <Divider />
          <div className="px-4 py-2">
            <Button
              className="w-full"
              size="sm"
              variant="flat"
              onPress={() => {
                setIsOpen(false);
                router.push("/settings?tab=admin");
              }}
            >
              {tJobs("viewAll")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Detail modal */}
      <JobDetailModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
      />
    </>
  );
}

// ── Tiny helpers ────────────────────────────────────────────────────────────

interface StepInfo {
  status: string;
}

function JobMiniCircle({ steps, status }: { steps: StepInfo[] | null; status: string }) {
  const total = steps?.length || 1;
  const done = steps?.filter((s) => s.status === "completed" || s.status === "skipped").length ?? 0;
  const circumference = 2 * Math.PI * 10;
  const dash = `${(done / total) * circumference}, ${circumference}`;

  let color = "stroke-primary";

  if (status === "completed") color = "stroke-success";
  if (status === "failed") color = "stroke-danger";

  return (
    <svg className="h-6 w-6 shrink-0 -rotate-90" viewBox="0 0 24 24">
      <circle
        className="stroke-default-200"
        cx="12"
        cy="12"
        fill="none"
        r="10"
        strokeDasharray="2,1"
        strokeWidth="2.5"
      />
      <circle
        className={color}
        cx="12"
        cy="12"
        fill="none"
        r="10"
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function JobMiniBadge({ status, label }: { status: string; label: string }) {
  const colorMap: Record<string, "default" | "primary" | "success" | "danger"> = {
    queued: "default",
    active: "primary",
    completed: "success",
    failed: "danger",
  };

  return (
    <Chip
      className="h-5 min-w-0 shrink-0 text-[10px] font-bold"
      color={colorMap[status] ?? "default"}
      size="sm"
      variant="flat"
    >
      {label}
    </Chip>
  );
}
