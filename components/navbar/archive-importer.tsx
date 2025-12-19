"use client";
import React, { useCallback, useRef, useState, useEffect } from "react";
import { Progress } from "@heroui/react";

import { useArchiveImportMutation } from "@/hooks/archive";
import { useArchiveImportContext } from "@/context/archive-import-context";

export default function ArchiveImporter() {
  // Use archive context for state
  const {
    current,
    imported,
    skipped,
    total,
    errors: progressErrors,
    isImporting,
    clearImport,
  } = useArchiveImportContext();
  const { startImport, isStarting } = useArchiveImportMutation();
  const [dragActive, setDragActive] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ file: string; error: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line no-console
  console.log("[Archive Importer] Render:", { current, imported, skipped, total, isImporting });

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

  // Auto-clear import state after completion (after 5 seconds)
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        clearImport();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isComplete, clearImport]);

  // Combine local errors with progress errors
  const allErrors = [
    ...localErrors,
    ...progressErrors.map((e) => ({ file: e.file, error: e.error })),
  ];

  // Status message
  let status = "";

  if (isStarting) {
    status = "Uploading file…";
  } else if (isImporting && total > 0) {
    const parts = [`${current} of ${total}`];

    if (imported > 0) parts.push(`${imported} imported`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (progressErrors.length > 0) parts.push(`${progressErrors.length} errors`);
    status = `Processing: ${parts.join(", ")}`;
  } else if (isComplete) {
    // Import complete - show appropriate message
    const parts = [];

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
          dragActive ? "border-primary/60 bg-primary/5" : "border-default-200",
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
            className="text-default-400 mx-auto size-12"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              clipRule="evenodd"
              d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
              fillRule="evenodd"
            />
          </svg>
          <div className="text-default-500 mt-4 flex items-center justify-center gap-1 text-sm">
            <label
              className="text-primary focus-within:outline-primary hover:text-primary-400 relative cursor-pointer rounded-md bg-transparent font-semibold focus-within:outline-2 focus-within:outline-offset-2"
              htmlFor="archive-file-upload"
            >
              <span>{isUploading ? "Uploading…" : "Upload a file"}</span>
              <input
                key={isComplete ? "reset" : "active"}
                ref={inputRef}
                accept=".melarecipes,.zip"
                className="sr-only"
                disabled={isStarting || isImporting}
                id="archive-file-upload"
                name="file-upload"
                type="file"
                onChange={onInputChange}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-default-500 text-xs">
            .melarecipes (Mela), .zip (Mealie or Tandoor export)
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {/* Progress bar when importing or just completed */}
        {(isImporting || isComplete) && total > 0 && (
          <Progress
            aria-label="Import progress"
            className="w-full"
            color={isComplete ? (progressErrors.length > 0 ? "warning" : "success") : "primary"}
            size="sm"
            value={(current / total) * 100}
          />
        )}

        {status && <div className="text-default-600 text-base">{status}</div>}
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
