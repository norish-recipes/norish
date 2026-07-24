"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/ui/data-table";
import {
  useAdminConfigsQuery,
  useJobListQuery,
  useJobQueueMutations,
  useQueueSummaryQuery,
} from "@/hooks/admin";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Pagination,
  Select,
  TextField,
} from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

import type { JobRetentionConfig } from "@norish/config/zod/server-config";
import type { AdminJobRowDTO } from "@norish/shared/contracts";
import { DEFAULT_JOB_RETENTION, ServerConfigKeys } from "@norish/config/zod/server-config";

import JobDetailModal from "./jobs/job-detail-modal";
import { formatDuration, formatStep } from "./jobs/job-format";
import JobStatusChip from "./jobs/job-status-chip";
import { RestartRequiredChip } from "./restart-required-chip";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

const QUEUE_OPTIONS = [
  "recipe-import",
  "image-recipe-import",
  "paste-recipe-import",
  "nutrition-estimation",
  "auto-tagging",
  "auto-categorization",
  "allergy-detection",
  "recipe-provenance",
  "caldav-sync",
  "scheduled-tasks",
] as const;

const ALL = "all";
const PAGE_SIZE = 10;

type StateFilter = "active" | "waiting" | "failed" | "completed" | null;

const STATE_FILTER_STATES: Record<Exclude<StateFilter, null>, string[]> = {
  active: ["active"],
  waiting: ["waiting", "delayed"],
  failed: ["failed"],
  completed: ["completed"],
};

export default function JobQueueCard() {
  const t = useTranslations("settings.admin.jobQueue");
  const tActions = useTranslations("common.actions");
  const { configs } = useAdminConfigsQuery();
  const { updateJobRetention, isUpdatingRetention } = useJobQueueMutations();
  const [queueFilter, setQueueFilter] = useState<string>(ALL);
  const [stateFilter, setStateFilter] = useState<StateFilter>(null);
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<{ queue: string; jobId: string } | null>(null);

  const { summaries } = useQueueSummaryQuery();
  const { jobs } = useJobListQuery({
    queue: queueFilter === ALL ? undefined : queueFilter,
    states: stateFilter ? STATE_FILTER_STATES[stateFilter] : undefined,
  });

  const storedRetention =
    (configs[ServerConfigKeys.JOB_RETENTION] as JobRetentionConfig | undefined) ??
    DEFAULT_JOB_RETENTION;
  const { keepCompleted, keepFailed, maxAgeDays } = storedRetention;
  const [retention, setRetention] = useState<JobRetentionConfig>(storedRetention);

  useEffect(() => {
    setRetention({ keepCompleted, keepFailed, maxAgeDays });
  }, [keepCompleted, keepFailed, maxAgeDays]);

  const hasRetentionChanges =
    retention.keepCompleted !== storedRetention.keepCompleted ||
    retention.keepFailed !== storedRetention.keepFailed ||
    retention.maxAgeDays !== storedRetention.maxAgeDays;

  const totals = summaries.reduce(
    (acc, summary) => ({
      active: acc.active + summary.counts.active,
      waiting: acc.waiting + summary.counts.waiting + summary.counts.delayed,
      failed: acc.failed + summary.counts.failed,
      completed: acc.completed + summary.counts.completed,
    }),
    { active: 0, waiting: 0, failed: 0, completed: 0 }
  );

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageJobs = jobs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleStateFilter = (state: Exclude<StateFilter, null>) => {
    setStateFilter((current) => (current === state ? null : state));
    setPage(1);
  };

  const handleSaveRetention = async () => {
    await updateJobRetention(retention);
  };

  const retentionField = (
    key: keyof JobRetentionConfig,
    label: string,
    min: number,
    max: number
  ) => (
    <TextField
      className="w-full sm:max-w-40"
      type="number"
      value={retention[key].toString()}
      onChange={(value) =>
        setRetention((current) => ({
          ...current,
          [key]: parseInt(value) || DEFAULT_JOB_RETENTION[key],
        }))
      }
    >
      <Label>{label}</Label>
      <Input max={max} min={min} variant="secondary" />
    </TextField>
  );

  // Colors match the row status chips: active blue, waiting orange,
  // failed red, completed primary (accent)
  const filterChip = (
    state: Exclude<StateFilter, null>,
    color: "accent" | "warning" | "danger" | "default"
  ) => (
    <Chip
      aria-pressed={stateFilter === state}
      as="button"
      className={
        state === "active"
          ? "chip--info cursor-pointer px-1 py-0.5 transition-all"
          : "cursor-pointer px-1 py-0.5 transition-all"
      }
      color={color}
      size="sm"
      type="button"
      variant={stateFilter === state ? "primary" : "soft"}
      onClick={() => handleStateFilter(state)}
    >
      {t(`status.${state}`)}: {totals[state]}
    </Chip>
  );

  return (
    <Card>
      <Card.Header>
        <div className="flex w-full items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <QueueListIcon className="h-5 w-5" />
            {t("title")}
          </h2>
          {totals.failed > 0 ? (
            <Chip color="danger" size="sm" variant="soft">
              {t("summary.failed", { count: totals.failed })}
            </Chip>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="gap-6">
        {/* Retention settings */}
        <div className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 font-medium">
            {t("retention.title")}
            <RestartRequiredChip />
            {hasRetentionChanges && <UnsavedChangesChip />}
          </h3>
          <div className="flex flex-col gap-4 sm:flex-row">
            {retentionField("keepCompleted", t("retention.keepCompleted"), 10, 5000)}
            {retentionField("keepFailed", t("retention.keepFailed"), 10, 5000)}
            {retentionField("maxAgeDays", t("retention.maxAgeDays"), 1, 90)}
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted text-xs">{t("retention.description")}</p>
            <Button
              isDisabled={!hasRetentionChanges}
              isPending={isUpdatingRetention}
              variant="primary"
              onPress={handleSaveRetention}
            >
              <CheckIcon className="h-5 w-5" />
              {tActions("save")}
            </Button>
          </div>
        </div>

        {/* Jobs */}
        <div className="border-divider flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {filterChip("active", "default")}
              {filterChip("waiting", "warning")}
              {filterChip("failed", "danger")}
              {filterChip("completed", "accent")}
            </div>
            <Select
              aria-label={t("filters.queue")}
              className="w-full sm:w-56"
              selectedKey={queueFilter}
              size="sm"
              variant="secondary"
              onSelectionChange={(key) => {
                if (typeof key === "string") {
                  setQueueFilter(key);
                  setPage(1);
                }
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom end">
                <ListBox>
                  <ListBox.Item key={ALL} id={ALL} textValue={t("filters.allQueues")}>
                    {t("filters.allQueues")}
                  </ListBox.Item>
                  {QUEUE_OPTIONS.map((option) => {
                    const label = t.has(`queues.${option}`) ? t(`queues.${option}`) : option;

                    return (
                      <ListBox.Item key={option} id={option} textValue={label}>
                        {label}
                      </ListBox.Item>
                    );
                  })}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <DataTable
            aria-label={t("title")}
            columns={[
              {
                key: "job",
                label: t("table.job"),
                isRowHeader: true,
                render: (job: AdminJobRowDTO) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {t.has(`queues.${job.queue}`) ? t(`queues.${job.queue}`) : job.queue}
                    </span>
                    {job.target ? (
                      <span className="text-muted max-w-64 truncate text-xs" title={job.target}>
                        {job.target}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "status",
                label: t("table.status"),
                render: (job: AdminJobRowDTO) => (
                  <JobStatusChip isHanging={job.isHanging} state={job.state} />
                ),
              },
              {
                key: "step",
                label: t("table.step"),
                className: "text-sm",
                render: (job: AdminJobRowDTO) =>
                  job.state === "active" && job.step ? formatStep(job.step, t) : "-",
              },
              {
                key: "duration",
                label: t("table.duration"),
                className: "text-sm",
                render: (job: AdminJobRowDTO) =>
                  job.state === "delayed" && job.runAt !== null
                    ? t("table.runsAt", {
                        time: formatDistanceToNow(new Date(job.runAt), { addSuffix: true }),
                      })
                    : formatDuration(job.durationMs),
              },
              {
                key: "created",
                label: t("table.created"),
                className: "text-muted text-xs",
                render: (job: AdminJobRowDTO) =>
                  formatDistanceToNow(new Date(job.createdAt), { addSuffix: true }),
              },
            ]}
            emptyState={t("empty")}
            rowKey={(job: AdminJobRowDTO) => `${job.queue}:${job.id}`}
            rows={pageJobs}
            onRowAction={(job: AdminJobRowDTO) =>
              setSelectedJob({ queue: job.queue, jobId: job.id })
            }
          />

          {totalPages > 1 ? (
            <div className="flex justify-center">
              {/* Pagination is a "dumb" compound component (Root/Previous/
                  Summary/Next) with no built-in state — no flat
                  page/total/onChange API, so wire it up manually. */}
              <Pagination aria-label={t("title")} size="sm">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      isDisabled={currentPage === 1}
                      onPress={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Pagination.Previous>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Summary>
                      {t("pagination", { current: currentPage, total: totalPages })}
                    </Pagination.Summary>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Next
                      isDisabled={currentPage === totalPages}
                      onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          ) : null}
        </div>
      </Card.Content>

      <JobDetailModal
        jobId={selectedJob?.jobId ?? null}
        queue={selectedJob?.queue ?? null}
        onClose={() => setSelectedJob(null)}
      />
    </Card>
  );
}
