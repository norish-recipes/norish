"use client";

import { useJobDetailQuery } from "@/hooks/admin/use-jobs-query";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ForwardIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import {
  Chip,
  Code,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import { JobStatusBadge } from "./job-status-badge";

interface JobDetailModalProps {
  jobId: string | null;
  onClose: () => void;
}

export default function JobDetailModal({ jobId, onClose }: JobDetailModalProps) {
  const t = useTranslations("settings.admin.jobs");
  const { job, isLoading } = useJobDetailQuery(jobId);

  return (
    <Modal
      isOpen={!!jobId}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          {t("detail.title")}
          {job && <JobStatusBadge status={job.status} />}
        </ModalHeader>
        <ModalBody className="gap-4 pb-6">
          {isLoading || !job ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetaField label={t("detail.queue")} value={t(`queues.${job.queueName}` as any)} />
                <MetaField label={t("detail.jobId")} value={job.jobId} mono />
                {job.description && (
                  <MetaField
                    label={t("detail.description")}
                    value={job.description}
                    span2
                  />
                )}
                {job.aiModel && (
                  <MetaField label={t("detail.aiModel")} value={job.aiModel} />
                )}
                {job.recipeId && (
                  <MetaField label={t("detail.recipe")} value={job.recipeId} mono />
                )}
                <MetaField
                  label={t("detail.createdAt")}
                  value={formatDateTime(job.createdAt)}
                />
                {job.startedAt && (
                  <MetaField
                    label={t("detail.startedAt")}
                    value={formatDateTime(job.startedAt)}
                  />
                )}
                {job.completedAt && (
                  <MetaField
                    label={t("detail.completedAt")}
                    value={formatDateTime(job.completedAt)}
                  />
                )}
                {job.startedAt && job.completedAt && (
                  <MetaField
                    label={t("detail.duration")}
                    value={formatDuration(job.startedAt, job.completedAt)}
                  />
                )}
              </div>

              {/* Error section */}
              {job.error && (
                <>
                  <Divider />
                  <div>
                    <h4 className="text-danger mb-1 text-sm font-semibold">
                      {t("detail.error")}
                    </h4>
                    <Code className="text-danger block max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                      {job.error}
                    </Code>
                  </div>
                </>
              )}

              {/* Pipeline steps */}
              <Divider />
              <div>
                <h4 className="mb-3 text-sm font-semibold">{t("detail.steps")}</h4>
                <div className="flex flex-col gap-1">
                  {(job.steps as StepRecord[] | null)?.map((step, idx) => (
                    <StepRow key={idx} step={step} />
                  ))}
                </div>
              </div>

              {/* Input data */}
              {job.input && (
                <>
                  <Divider />
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">{t("detail.input")}</h4>
                    <Code className="block max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(job.input, null, 2)}
                    </Code>
                  </div>
                </>
              )}

              {/* Result data */}
              {job.result && (
                <>
                  <Divider />
                  <div>
                    <h4 className="mb-1 text-sm font-semibold">{t("detail.result")}</h4>
                    <Code className="block max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(job.result, null, 2)}
                    </Code>
                  </div>
                </>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

interface StepRecord {
  name: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
}

function StepRow({ step }: { step: StepRecord }) {
  const t = useTranslations("settings.admin.jobs.stepStatus");

  return (
    <div className="flex items-start gap-2 rounded-md px-2 py-1.5">
      {/* Status icon */}
      <StepIcon status={step.status} />

      {/* Step name + timing */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize">
            {step.name.replace(/_/g, " ")}
          </span>
          <Chip
            className="h-5"
            color={stepChipColor(step.status)}
            size="sm"
            variant="dot"
          >
            {t(step.status as any)}
          </Chip>
        </div>

        {/* Timing */}
        {step.startedAt && step.completedAt && (
          <span className="text-default-400 text-xs">
            {formatDuration(step.startedAt, step.completedAt)}
          </span>
        )}

        {/* Error */}
        {step.error && (
          <p className="text-danger mt-0.5 text-xs">{step.error}</p>
        )}

        {/* Output preview */}
        {step.output && !step.error && (
          <p className="text-default-400 mt-0.5 truncate text-xs">
            {typeof step.output === "string"
              ? step.output
              : JSON.stringify(step.output)}
          </p>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
  const className = "h-4 w-4 mt-0.5 shrink-0";

  switch (status) {
    case "completed":
      return <CheckCircleIcon className={`${className} text-success`} />;
    case "failed":
      return <XCircleIcon className={`${className} text-danger`} />;
    case "active":
      return <Spinner className={className} size="sm" />;
    case "skipped":
      return <ForwardIcon className={`${className} text-default-300`} />;
    default:
      return <ClockIcon className={`${className} text-default-300`} />;
  }
}

function stepChipColor(status: string): "default" | "primary" | "success" | "danger" | "warning" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "active":
      return "primary";
    case "skipped":
      return "warning";
    default:
      return "default";
  }
}

function MetaField({
  label,
  value,
  mono,
  span2,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <span className="text-default-400 text-xs">{label}</span>
      <p className={`text-sm ${mono ? "font-mono" : ""} truncate`}>{value}</p>
    </div>
  );
}

function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";

  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(start: string | Date, end: string | Date): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;

  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);

  return `${min}m ${sec}s`;
}
