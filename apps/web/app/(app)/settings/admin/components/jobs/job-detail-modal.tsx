"use client";

import { useState } from "react";
import { useJobDetailQuery, useJobQueueMutations } from "@/hooks/admin";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  MinusCircleIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { Accordion, Button, Chip, Modal, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AdminJobAttemptDTO, AdminJobStepDTO } from "@norish/shared/contracts";

import { formatDuration, formatStep, formatTimestamp } from "./job-format";
import JobStatusChip from "./job-status-chip";

type Translate = ReturnType<typeof useTranslations>;

type Props = {
  queue: string | null;
  jobId: string | null;
  onClose: () => void;
};

type ConfirmAction = "remove" | null;

const stepStatusColors: Record<
  AdminJobStepDTO["status"],
  "success" | "danger" | "accent" | "default" | "warning"
> = {
  done: "success",
  failed: "danger",
  running: "accent",
  skipped: "warning",
  pending: "default",
};

function StepIcon({ status }: { status: AdminJobStepDTO["status"] }) {
  switch (status) {
    case "done":
      return <CheckCircleIcon className="text-success h-5 w-5" />;
    case "failed":
      return <XCircleIcon className="text-danger h-5 w-5" />;
    case "running":
      return <Spinner size="sm" />;
    case "skipped":
      return <MinusCircleIcon className="text-warning h-5 w-5" />;
    case "pending":
      return <ClockIcon className="text-muted h-5 w-5" />;
  }
}

/** Short "-" marker used for a skipped step's duration slot. */
function stepMeta(step: AdminJobStepDTO): string | null {
  if (step.status === "skipped") return "-";

  return step.durationMs !== null ? formatDuration(step.durationMs) : null;
}

function StepList({ steps, t }: { steps: AdminJobStepDTO[]; t: Translate }) {
  return (
    <ul className="flex flex-col">
      {steps.map((step, index) => {
        const meta = stepMeta(step);

        return (
          <li key={`${step.id}-${index}`} className="flex gap-3 py-2">
            <div className="mt-0.5 shrink-0">
              <StepIcon status={step.status} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={
                    step.status === "skipped" || step.status === "pending"
                      ? "text-muted text-sm font-medium"
                      : "text-sm font-medium"
                  }
                >
                  {formatStep(step.id, t)}
                </span>
                <Chip color={stepStatusColors[step.status]} size="sm" variant="soft">
                  {t(`stepStatus.${step.status}`)}
                </Chip>
              </div>
              {meta ? <span className="text-muted text-xs">{meta}</span> : null}
              {step.detailJson ? (
                <span className="text-muted font-mono text-xs break-all">{step.detailJson}</span>
              ) : null}
              {step.error ? (
                <span className="text-danger text-xs break-all">{step.error}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Body of one attempt's accordion panel: error, steps, and logs. */
function AttemptBody({ attempt, t }: { attempt: AdminJobAttemptDTO; t: Translate }) {
  return (
    <div className="flex flex-col gap-3">
      {attempt.message ? (
        <div className="flex flex-col gap-1">
          <p className="text-danger text-sm break-all">{attempt.message}</p>
          {attempt.stack ? (
            <details className="text-muted text-xs">
              <summary className="cursor-pointer">{t("detail.stackTrace")}</summary>
              <pre className="bg-danger/10 text-danger mt-1 max-h-56 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                {attempt.stack}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
      {attempt.steps.length > 0 ? <StepList steps={attempt.steps} t={t} /> : null}
      {attempt.logs.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted text-xs font-medium">{t("detail.sections.logs")}</span>
          <pre className="bg-surface-secondary max-h-40 overflow-auto rounded-lg p-3 text-xs">
            {attempt.logs.join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export default function JobDetailModal({ queue, jobId, onClose }: Props) {
  const t = useTranslations("settings.admin.jobQueue");
  const tActions = useTranslations("common.actions");
  const isOpen = !!queue && !!jobId;
  const { job, isLoading, error } = useJobDetailQuery({
    queue: queue ?? "",
    jobId: jobId ?? "",
    enabled: isOpen,
  });
  const { retryJob, removeJob, isRetrying, isRemoving } = useJobQueueMutations();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const close = () => {
    setConfirmAction(null);
    setActionError(null);
    onClose();
  };

  // Retry is instant — no confirmation. Remove is destructive, so it confirms.
  const handleRetry = async () => {
    if (!queue || !jobId) return;

    setActionError(null);
    const result = await retryJob(queue, jobId);

    if (!result.success) {
      setActionError(result.error);
    }
  };

  const handleRemove = async () => {
    if (!queue || !jobId) return;

    const result = await removeJob(queue, jobId);

    setConfirmAction(null);

    if (!result.success) {
      setActionError(result.error);

      return;
    }

    setActionError(null);
    close();
  };

  const field = (label: string, value: string, fullWidth = false) => (
    <div className={fullWidth ? "col-span-2" : undefined}>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="truncate text-sm" title={value}>
        {value}
      </dd>
    </div>
  );

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      <Modal.Container className="z-[1100] max-w-2xl">
        <Modal.Dialog className="max-h-[85vh]">
          {() => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex items-center gap-3">
                  {t("detail.title")}
                  {job ? <JobStatusChip isHanging={job.isHanging} state={job.state} /> : null}
                </div>
              </Modal.Header>
              <Modal.Body className="gap-6">
                {isLoading && !job ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : null}
                {error && !job ? (
                  <p className="text-danger text-sm">{t("detail.notFound")}</p>
                ) : null}
                {job ? (
                  <>
                    {/* Overview fields */}
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {field(
                        t("detail.fields.queue"),
                        t.has(`queues.${job.queue}`) ? t(`queues.${job.queue}`) : job.queue
                      )}
                      {field(t("detail.fields.jobId"), job.id)}
                      {job.target ? field(t("detail.fields.description"), job.target, true) : null}
                      {job.recipeId ? field(t("detail.fields.recipe"), job.recipeId) : null}
                      {field(t("detail.fields.created"), formatTimestamp(job.createdAt))}
                      {job.state === "delayed" && job.runAt !== null
                        ? field(
                            job.isRepeat ? t("detail.fields.nextRun") : t("detail.fields.runsAt"),
                            formatTimestamp(job.runAt)
                          )
                        : null}
                      {field(t("detail.fields.started"), formatTimestamp(job.processedOn))}
                      {field(t("detail.fields.finished"), formatTimestamp(job.finishedOn))}
                      {field(t("detail.fields.duration"), formatDuration(job.durationMs))}
                      {field(t("detail.fields.attempts"), `${job.attemptsMade}/${job.maxAttempts}`)}
                    </dl>

                    {/* Input payload (moved to top) */}
                    <div className="flex flex-col gap-2">
                      <h3 className="border-divider border-t pt-4 font-semibold">
                        {t("detail.sections.input")}
                      </h3>
                      <pre className="bg-surface-secondary max-h-56 overflow-auto rounded-lg p-3 text-xs">
                        {job.dataJson}
                      </pre>
                    </div>

                    {/* Attempts: collapsible, one accordion item per attempt */}
                    {job.attempts.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <h3 className="border-divider border-t pt-4 font-semibold">
                          {t("detail.sections.pipelineSteps")}
                        </h3>
                        <Accordion
                          allowsMultipleExpanded
                          defaultExpandedKeys={[
                            // Expand the most recent attempt by default.
                            `attempt-${job.attempts[job.attempts.length - 1]?.attempt}`,
                          ]}
                          variant="surface"
                        >
                          {job.attempts.map((attempt) => (
                            <Accordion.Item key={attempt.attempt} id={`attempt-${attempt.attempt}`}>
                              <Accordion.Heading>
                                <Accordion.Trigger>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {t("detail.attempt", { number: attempt.attempt })}
                                    </span>
                                    <Chip
                                      color={attempt.message ? "danger" : "success"}
                                      size="sm"
                                      variant="soft"
                                    >
                                      {attempt.message
                                        ? t("stepStatus.failed")
                                        : t("stepStatus.done")}
                                    </Chip>
                                  </div>
                                  <Accordion.Indicator />
                                </Accordion.Trigger>
                              </Accordion.Heading>
                              <Accordion.Panel>
                                <Accordion.Body>
                                  <AttemptBody attempt={attempt} t={t} />
                                </Accordion.Body>
                              </Accordion.Panel>
                            </Accordion.Item>
                          ))}
                        </Accordion>
                      </div>
                    ) : job.failedReason ? (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-danger border-divider border-t pt-4 font-semibold">
                          {t("detail.sections.error")}
                        </h3>
                        <p className="text-danger text-sm break-all">{job.failedReason}</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {actionError ? <p className="text-danger text-sm">{actionError}</p> : null}
              </Modal.Body>
              <Modal.Footer>
                {confirmAction === "remove" ? (
                  <>
                    <span className="text-muted mr-auto self-center text-sm">
                      {t("removeModal.message")}
                    </span>
                    <Button variant="tertiary" onPress={() => setConfirmAction(null)}>
                      {tActions("cancel")}
                    </Button>
                    <Button isPending={isRemoving} variant="danger" onPress={handleRemove}>
                      {t("removeModal.confirm")}
                    </Button>
                  </>
                ) : (
                  <>
                    {job?.state === "failed" ? (
                      <Button isPending={isRetrying} variant="primary" onPress={handleRetry}>
                        <ArrowPathIcon className="h-4 w-4" />
                        {t("actions.retry")}
                      </Button>
                    ) : null}
                    {job && !job.isRepeat && job.state !== "active" ? (
                      <Button variant="danger-soft" onPress={() => setConfirmAction("remove")}>
                        <TrashIcon className="h-4 w-4" />
                        {t("actions.remove")}
                      </Button>
                    ) : null}
                    <Button variant="tertiary" onPress={close}>
                      {tActions("close")}
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
