"use client";

import { useState } from "react";
import { useJobsListQuery, useJobStatsQuery } from "@/hooks/admin/use-jobs-query";
import {
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QueueListIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Select,
  SelectItem,
  Spinner,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import JobDetailModal from "./job-detail-modal";
import { JobStatusBadge } from "./job-status-badge";

const QUEUE_OPTIONS = [
  "recipe-import",
  "image-recipe-import",
  "paste-recipe-import",
  "caldav-sync",
  "scheduled-tasks",
  "nutrition-estimation",
  "auto-tagging",
  "auto-categorization",
  "allergy-detection",
] as const;

const STATUS_OPTIONS = ["queued", "active", "completed", "failed"] as const;

const PAGE_SIZE = 10;

export default function JobsCard() {
  const t = useTranslations("settings.admin.jobs");

  const [queueFilter, setQueueFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { jobs, total, isLoading, invalidate } = useJobsListQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    queueName: queueFilter || undefined,
    status: (statusFilter as "queued" | "active" | "completed" | "failed") || undefined,
  });

  const { stats } = useJobStatsQuery();

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <QueueListIcon className="h-5 w-5" />
            {t("title")}
          </h2>
          <div className="flex items-center gap-2">
            {/* Stats chips */}
            {(stats.byStatus.active ?? 0) > 0 && (
              <Chip color="primary" size="sm" variant="flat">
                {stats.byStatus.active} {t("stats.active")}
              </Chip>
            )}
            {(stats.byStatus.failed ?? 0) > 0 && (
              <Chip color="danger" size="sm" variant="flat">
                {stats.byStatus.failed} {t("stats.failed")}
              </Chip>
            )}
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={invalidate}
            >
              <ArrowPathIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardBody className="gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select
              className="max-w-[200px]"
              label={t("filters.allQueues")}
              selectedKeys={queueFilter ? [queueFilter] : []}
              size="sm"
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;

                setQueueFilter(val ?? "");
                setPage(0);
              }}
            >
              {QUEUE_OPTIONS.map((q) => (
                <SelectItem key={q}>{t(`queues.${q}`)}</SelectItem>
              ))}
            </Select>

            <Select
              className="max-w-[180px]"
              label={t("filters.allStatuses")}
              selectedKeys={statusFilter ? [statusFilter] : []}
              size="sm"
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string;

                setStatusFilter(val ?? "");
                setPage(0);
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s}>{t(`status.${s}`)}</SelectItem>
              ))}
            </Select>
          </div>

          <Divider />

          {/* Job list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-default-400 py-8 text-center text-sm">{t("empty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  className="hover:bg-default-100 flex items-center gap-3 rounded-lg p-3 text-left transition-colors"
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                >
                  {/* Progress indicator */}
                  <JobProgressCircle steps={job.steps as any} status={job.status} />

                  {/* Job info */}
                  <div className="min-w-0 flex-1">
                    <div className="text-default-400 text-xs">
                      {t(`queues.${job.queueName}` as any)}
                    </div>
                    <div className="truncate text-sm font-medium">
                      {job.description || job.jobId}
                    </div>
                  </div>

                  {/* Status badge */}
                  <JobStatusBadge status={job.status} />

                  {/* Timestamp */}
                  <span className="text-default-400 hidden text-xs whitespace-nowrap sm:block">
                    {formatRelativeTime(job.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <>
              <Divider />
              <div className="flex items-center justify-between">
                <span className="text-default-500 text-xs">
                  {t("pagination.showing", { from, to, total })}
                </span>
                <div className="flex gap-1">
                  <Button
                    isIconOnly
                    isDisabled={page === 0}
                    size="sm"
                    variant="flat"
                    onPress={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    isIconOnly
                    isDisabled={page >= totalPages - 1}
                    size="sm"
                    variant="flat"
                    onPress={() => setPage((p) => p + 1)}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Detail modal */}
      <JobDetailModal
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
      />
    </>
  );
}

/**
 * Small SVG progress circle showing pipeline completion.
 */
function JobProgressCircle({
  steps,
  status,
}: {
  steps: { status: string }[] | null;
  status: string;
}) {
  const totalSteps = steps?.length || 1;
  const completedSteps = steps?.filter(
    (s) => s.status === "completed" || s.status === "skipped"
  ).length ?? 0;

  const circumference = 2 * Math.PI * 14;
  const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const dashArray = `${progress * circumference}, ${circumference}`;

  let strokeColor = "stroke-primary"; // active/queued

  if (status === "completed") strokeColor = "stroke-success";
  if (status === "failed") strokeColor = "stroke-danger";

  return (
    <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
      <circle
        className="stroke-default-200"
        cx="16"
        cy="16"
        fill="none"
        r="14"
        strokeDasharray="2, 1"
        strokeWidth="3"
      />
      <circle
        className={strokeColor}
        cx="16"
        cy="16"
        fill="none"
        r="14"
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

/**
 * Format a date as relative time (e.g. "2m ago", "1h ago").
 */
function formatRelativeTime(date: string | Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);

  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);

  return `${diffDay}d ago`;
}
