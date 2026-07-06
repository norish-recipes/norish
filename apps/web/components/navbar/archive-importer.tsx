"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useArchiveImportContext } from "@/context/archive-import-context";
import { useArchiveImportMutation } from "@/hooks/archive";
import { ProgressBar } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function ArchiveImporter() {
  const t = useTranslations("navbar.archiveImporter");
  // Use archive context for state
  const {
    current,
    imported,
    skipped,
    skippedItems,
    total,
    errors: progressErrors,
    isImporting,
    clearImport,
  } = useArchiveImportContext();
  const { startImport, isStarting } = useArchiveImportMutation();
  const [dragActive, setDragActive] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ file: string; error: string }[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    (file: File) => {
      setLocalErrors([]);
      clearImport();
      startImport(file);
    },
    [startImport, clearImport]
  );

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];

    if (!f) return;
    uploadFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];

    if (f) uploadFile(f);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const isUploading = isStarting || isImporting;

  // Detect completion: import was active, now finished, and we have results
  const isComplete = !isImporting && current > 0 && current === total;

  // Auto-clear import state after completion
  useEffect(() => {
    if (isComplete) {
      const timeout = 60000;
      const timer = setTimeout(() => {
        clearImport();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [isComplete, skippedItems.length, clearImport]);

  // Combine local errors with progress errors
  const allErrors = [
    ...localErrors,
    ...progressErrors.map((e) => ({ file: e.file, error: e.error })),
  ];

  // Status message
  let status = "";

  if (isStarting) {
    status = t("uploadingFile");
  } else if (isImporting && total > 0) {
    const parts = [`${current} of ${total}`];

    if (imported > 0) parts.push(`${imported} imported`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (progressErrors.length > 0) parts.push(`${progressErrors.length} errors`);
    status = `Processing: ${parts.join(", ")}`;
  } else if (isComplete) {
    // Import complete - show appropriate message
    const parts: string[] = [];

    if (imported > 0) parts.push(`${imported} imported`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (progressErrors.length > 0) parts.push(`${progressErrors.length} errors`);
    status = `Complete: ${parts.join(", ")}`;
  }

  return (
    <div className="col-span-full">
      <div
        aria-label="Upload a recipe archive file"
        className={[
          "mt-2 flex justify-center rounded-lg border border-dashed px-6 py-10 transition-colors",
          dragActive ? "border-accent/60 bg-accent/5" : "border-border",
        ].join(" ")}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <div className="text-center">
          <svg
            aria-hidden="true"
            className="text-muted mx-auto size-12"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              clipRule="evenodd"
              d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
              fillRule="evenodd"
            />
          </svg>
          <div className="text-muted mt-4 flex items-center justify-center gap-1 text-sm">
            <label
              className="text-accent focus-within:outline-primary hover:text-accent relative cursor-pointer rounded-md bg-transparent font-semibold focus-within:outline-2 focus-within:outline-offset-2"
              htmlFor="archive-file-upload"
            >
              <span>{isUploading ? t("uploading") : t("uploadFile")}</span>
              <input
                key={isComplete ? "reset" : "active"}
                ref={inputRef}
                accept=".melarecipes,.paprikarecipes,.zip"
                className="sr-only"
                disabled={isStarting || isImporting}
                id="archive-file-upload"
                name="file-upload"
                type="file"
                onChange={onInputChange}
              />
            </label>
            <p className="pl-1">{t("dragDrop")}</p>
          </div>
          <p className="text-muted text-xs">{t("formats")}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {/* ProgressBar bar when importing or just completed */}
        {(isImporting || isComplete) && total > 0 && (
          <ProgressBar
            aria-label="Import progress"
            className="w-full"
            color={isComplete ? (progressErrors.length > 0 ? "warning" : "success") : "accent"}
            size="sm"
            value={(current / total) * 100}
          />
        )}

        {status && <div className="text-muted text-base">{status}</div>}

        {/* Show skipped recipes with toggle */}
        {isComplete && skippedItems.length > 0 && (
          <div className="text-muted text-sm">
            <button
              className="hover:text-foreground underline underline-offset-2"
              type="button"
              onClick={() => setShowSkipped(!showSkipped)}
            >
              {showSkipped ? "Hide" : "Show"} {skippedItems.length} skipped recipe
              {skippedItems.length !== 1 ? "s" : ""}
            </button>
            {showSkipped && (
              <ul className="mt-1 list-disc pl-4">
                {skippedItems.map((s, i) => (
                  <li key={i}>
                    {s.file}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {allErrors.length > 0 && (
          <ul className="text-danger list-disc pl-4 text-base">
            {allErrors.map((e, i) => (
              <li key={i}>
                {e.file}: {String(e.error)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
