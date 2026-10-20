"use client";

import type { BulkImportNotice } from "@/components/import/bulk-image-import-state";
import type { DropZoneAreaProps } from "@/components/ui/drop-zone";
import { useCallback, useEffect, useReducer, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTRPC } from "@/app/providers/trpc-provider";
import {
  bulkImageImportReducer,
  bulkImportProgress,
  canSubmitBulkImport,
  initialBulkImportState,
  isBulkImportSettled,
  retryableBulkImportItemIds,
  selectBulkImportFiles,
} from "@/components/import/bulk-image-import-state";
import { DropZone } from "@/components/ui/drop-zone";
import { useBulkImport } from "@/context/bulk-import-context";
import { usePermissionsContext } from "@/context/permissions-context";
import { useUploadLimitsQuery } from "@/hooks/config";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PhotoIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Button, Chip, ProgressBar } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { ImageImportBatchStatus } from "@norish/shared/contracts";
import {
  ALLOWED_OCR_MIME_SET,
  ALLOWED_OCR_MIME_TYPES,
  MAX_BULK_IMAGE_BATCH_BYTES,
  MAX_OCR_FILES,
} from "@norish/shared/contracts";

const ACCEPT = ALLOWED_OCR_MIME_TYPES.join(",");
const BYTES_PER_MEGABYTE = 1024 * 1024;
const STATUS_COLOR: Record<ImageImportBatchStatus, "default" | "accent" | "success" | "danger"> = {
  queued: "default",
  processing: "accent",
  done: "success",
  failed: "danger",
};

function noticeKey(notice: BulkImportNotice): string {
  return `${notice.code}:${notice.filename ?? ""}`;
}

function StatusIcon({ status }: { status: ImageImportBatchStatus }) {
  const className = "mt-0.5 h-5 w-5 shrink-0";

  switch (status) {
    case "done":
      return <CheckCircleIcon aria-hidden className={`${className} text-success`} />;
    case "failed":
      return <ExclamationCircleIcon aria-hidden className={`${className} text-danger`} />;
    case "processing":
      return <ArrowPathIcon aria-hidden className={`${className} text-accent animate-spin`} />;
    case "queued":
      return <ClockIcon aria-hidden className={`${className} text-muted`} />;
  }
}

export default function BulkImageImport() {
  const t = useTranslations("recipes.bulkImport");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isAIEnabled } = usePermissionsContext();
  const { trackBatch } = useBulkImport();
  const { limits } = useUploadLimitsQuery();
  const [state, dispatch] = useReducer(bulkImageImportReducer, initialBulkImportState);
  const previewsRef = useRef<string[]>([]);
  const submittingRef = useRef(false);
  const batchId = state.batch?.batchId ?? null;
  const maxMegabytes = Math.round(limits.maxImageSize / BYTES_PER_MEGABYTE);
  const maxTotalMegabytes = Math.round(MAX_BULK_IMAGE_BATCH_BYTES / BYTES_PER_MEGABYTE);

  const statusQuery = useQuery({
    ...trpc.recipes.imageImportBatchStatus.queryOptions({ batchId: batchId ?? "" }),
    enabled: batchId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;

      return data && !isBulkImportSettled(data) ? 2000 : false;
    },
  });

  useEffect(() => {
    previewsRef.current = state.files.map((file) => file.previewUrl);
  }, [state.files]);

  useEffect(() => {
    return () => {
      for (const preview of previewsRef.current) {
        URL.revokeObjectURL(preview);
      }
    };
  }, []);

  useEffect(() => {
    if (statusQuery.data) {
      dispatch({ type: "batch-updated", batch: statusQuery.data });
    }
  }, [statusQuery.data]);

  const importMutation = useMutation(
    trpc.recipes.importFromImagesBatch.mutationOptions({
      onSuccess: (batch) => {
        submittingRef.current = false;

        trackBatch(
          batch.batchId,
          state.files.map((file) => file.file)
        );

        for (const file of state.files) {
          URL.revokeObjectURL(file.previewUrl);
        }

        queryClient.setQueryData(
          trpc.recipes.imageImportBatchStatus.queryKey({ batchId: batch.batchId }),
          batch
        );
        dispatch({ type: "batch-received", batch });
      },
      onError: (error) => {
        submittingRef.current = false;
        dispatch({ type: "submission-failed" });
        showSafeErrorToast({
          title: t("submitFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "bulk-image-import:submit",
        });
      },
    })
  );

  const retryMutation = useMutation(
    trpc.recipes.retryImageBatchItems.mutationOptions({
      onSuccess: (batch) => {
        queryClient.setQueryData(
          trpc.recipes.imageImportBatchStatus.queryKey({ batchId: batch.batchId }),
          batch
        );
        dispatch({ type: "batch-updated", batch });
      },
      onError: (error) => {
        showSafeErrorToast({
          title: t("retryFailed"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "bulk-image-import:retry",
        });
      },
    })
  );

  const handleAddFiles = useCallback(
    (selected: File[] | FileList | null) => {
      if (!selected) return;

      const files = Array.isArray(selected) ? selected : Array.from(selected);
      const { accepted, notices } = selectBulkImportFiles(state.files, files, {
        allowedMimeTypes: ALLOWED_OCR_MIME_SET,
        maxImageSize: limits.maxImageSize,
        maxFiles: MAX_OCR_FILES,
        maxTotalSize: MAX_BULK_IMAGE_BATCH_BYTES,
      });

      dispatch({
        type: "files-added",
        files: accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
        notices,
      });
    },
    [limits.maxImageSize, state.files]
  );

  const handleRemove = useCallback(
    (localId: string) => {
      const removed = state.files.find((file) => file.localId === localId);

      if (removed) URL.revokeObjectURL(removed.previewUrl);
      dispatch({ type: "file-removed", localId });
    },
    [state.files]
  );

  const handleClear = useCallback(() => {
    for (const file of state.files) {
      URL.revokeObjectURL(file.previewUrl);
    }

    dispatch({ type: "files-cleared" });
  }, [state.files]);

  const handleDrop = useCallback<NonNullable<DropZoneAreaProps["onDrop"]>>(
    (event) => {
      void (async () => {
        const dropped: File[] = [];

        for (const item of event.items) {
          if (item.kind === "file") {
            dropped.push(await item.getFile());
          }
        }

        handleAddFiles(dropped);
      })();
    },
    [handleAddFiles]
  );

  const getDropOperation = useCallback<NonNullable<DropZoneAreaProps["getDropOperation"]>>(
    (types) => (ALLOWED_OCR_MIME_TYPES.some((type) => types.has(type)) ? "copy" : "cancel"),
    []
  );

  const handleSubmit = useCallback(() => {
    if (submittingRef.current || !canSubmitBulkImport(state, importMutation.isPending)) return;

    submittingRef.current = true;

    const formData = new FormData();

    state.files.forEach((file, index) => {
      formData.append(`file${index}`, file.file);
    });

    dispatch({ type: "submission-started" });
    importMutation.mutate(formData);
  }, [importMutation, state]);

  const handleRetry = useCallback(
    (itemIds: string[]) => {
      if (!batchId || itemIds.length === 0) return;

      retryMutation.mutate({ batchId, itemIds });
    },
    [batchId, retryMutation]
  );

  const progress = bulkImportProgress(state.batch);
  const retryableIds = retryableBulkImportItemIds(state.batch);
  const settled = isBulkImportSettled(state.batch);
  const progressPercent =
    progress.total === 0 ? 0 : ((progress.done + progress.failed) / progress.total) * 100;
  const noticeMessage = (notice: BulkImportNotice): string => {
    switch (notice.code) {
      case "unsupported":
        return t("invalidTypeDetail", { name: notice.filename });
      case "too-large":
        return t("tooLargeDetail", { name: notice.filename, size: maxMegabytes });
      case "duplicate":
        return t("duplicateDetail", { name: notice.filename });
      case "total-too-large":
        return t("totalTooLargeDetail", { size: maxTotalMegabytes });
      case "limit":
        return t("limitDetail", { max: notice.max });
    }
  };

  if (!isAIEnabled) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("aiDisabled")}</p>
        <Link className="text-accent text-sm underline underline-offset-2" href="/">
          {t("backToRecipes")}
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link className="text-muted text-sm underline underline-offset-2" href="/">
          {t("backToRecipes")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted text-sm">{t("description")}</p>
      </header>

      {state.batch ? (
        <section aria-labelledby="bulk-import-progress-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold" id="bulk-import-progress-title">
              {t("progressTitle")}
            </h2>
            <p aria-live="polite" className="text-muted text-sm">
              {t("progressCount", { done: progress.done, total: progress.total })}
            </p>
          </div>

          <ProgressBar
            aria-label={t("progressTitle")}
            color={progress.failed > 0 && settled ? "warning" : "accent"}
            value={progressPercent}
          />

          {progress.failed > 0 ? (
            <p className="text-danger text-sm">{t("progressFailed", { count: progress.failed })}</p>
          ) : null}

          {settled && progress.failed === 0 ? (
            <p className="text-success flex items-center gap-2 text-sm">
              <CheckCircleIcon className="h-4 w-4" />
              {t("allDone")}
            </p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {state.batch.items.map((item) => (
              <li
                key={item.itemId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-(--border-secondary) p-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={item.filename}>
                      {item.filename}
                    </p>
                    {item.status === "failed" ? (
                      <p className="text-danger mt-1 text-xs" role="status">
                        {t(`error.${item.errorCode ?? "extraction-failed"}`)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Chip color={STATUS_COLOR[item.status]} size="sm" variant="secondary">
                    <Chip.Label>{t(`status.${item.status}`)}</Chip.Label>
                  </Chip>

                  {item.status === "done" && item.recipeId ? (
                    <Link
                      className="text-accent text-sm underline underline-offset-2"
                      href={`/recipes/${item.recipeId}`}
                    >
                      {t("openRecipe")}
                    </Link>
                  ) : null}

                  {item.retryable ? (
                    <Button
                      isDisabled={retryMutation.isPending}
                      size="sm"
                      variant="secondary"
                      onPress={() => handleRetry([item.itemId])}
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" />
                      {t("retry")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {retryableIds.length > 1 ? (
            <Button
              className="self-start"
              isDisabled={retryMutation.isPending}
              variant="secondary"
              onPress={() => handleRetry(retryableIds)}
            >
              <ArrowPathIcon className="h-4 w-4" />
              {t("retryAll")}
            </Button>
          ) : null}
        </section>
      ) : (
        <>
          <DropZone className="w-full">
            <DropZone.Area getDropOperation={getDropOperation} onDrop={handleDrop}>
              <DropZone.Icon>
                <PhotoIcon />
              </DropZone.Icon>
              <DropZone.Label>{t("dropzone")}</DropZone.Label>
              <DropZone.Description>
                {t("formats", {
                  max: MAX_OCR_FILES,
                  size: maxMegabytes,
                  total: maxTotalMegabytes,
                })}
              </DropZone.Description>
              <DropZone.Trigger>{t("choose")}</DropZone.Trigger>
            </DropZone.Area>
            <DropZone.Input
              multiple
              accept={ACCEPT}
              aria-label={t("choose")}
              onSelect={handleAddFiles}
            />
          </DropZone>

          {state.notices.length > 0 ? (
            <div
              className="border-danger/40 bg-danger-soft/40 flex flex-col gap-2 rounded-lg border p-3"
              role="alert"
            >
              <ul className="flex flex-col gap-1">
                {state.notices.map((notice, index) => (
                  <li key={`${noticeKey(notice)}-${index}`} className="text-danger text-sm">
                    {noticeMessage(notice)}
                  </li>
                ))}
              </ul>
              <Button
                className="self-start"
                size="sm"
                variant="tertiary"
                onPress={() => dispatch({ type: "notices-dismissed" })}
              >
                {t("dismiss")}
              </Button>
            </div>
          ) : null}

          {state.files.length > 0 ? (
            <>
              <ul
                aria-label={t("selectedCount", { count: state.files.length })}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              >
                {state.files.map((file) => (
                  <li
                    key={file.localId}
                    className="group relative flex flex-col rounded-lg border border-(--border-secondary) p-2"
                  >
                    <Image
                      unoptimized
                      alt=""
                      className="h-24 w-full rounded-md object-cover"
                      height={96}
                      src={file.previewUrl}
                      width={192}
                    />
                    <p className="mt-2 truncate text-xs" title={file.filename}>
                      {file.filename}
                    </p>
                    <Button
                      isIconOnly
                      aria-label={t("remove", { name: file.filename })}
                      className="absolute top-1 right-1"
                      size="sm"
                      variant="danger"
                      onPress={() => handleRemove(file.localId)}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted text-sm">
                  {t("selectedCount", { count: state.files.length })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    isDisabled={importMutation.isPending || state.submitting}
                    variant="tertiary"
                    onPress={handleClear}
                  >
                    {t("clear")}
                  </Button>
                  <Button
                    isDisabled={importMutation.isPending || state.submitting}
                    isPending={importMutation.isPending || state.submitting}
                    variant="primary"
                    onPress={handleSubmit}
                  >
                    {t("importButton", { count: state.files.length })}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
