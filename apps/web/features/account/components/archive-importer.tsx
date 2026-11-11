"use client";

import React, { useEffect, useRef, useState } from "react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import { ProgressBar } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useArchiveImport, useArchiveImportMutation } from "@norish/shared-react/recipes";

export default function ArchiveImporter() {
  const t = useTranslations("navbar.archiveImporter");
  const {
    current,
    imported,
    notes,
    total,
    errors: progressErrors,
    isImporting,
    clear: clearImport,
  } = useArchiveImport();
  const { startImport, isStarting } = useArchiveImportMutation();
  const [dragActive, setDragActive] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = (file: File) => {
    clearImport();
    startImport(file);
  };

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

  const isComplete = !isImporting && current > 0 && current === total;

  // A finished import's result clears after a minute.
  useEffect(() => {
    if (isComplete) {
      const timeout = 60000;
      const timer = setTimeout(() => {
        clearImport();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [isComplete, notes.length, clearImport]);

  // Status message. The counts are phrased as their own messages and joined
  // into the `{details}` slot the `processing`/`complete` strings expose.
  const countParts = () => {
    const parts: string[] = [];

    if (imported > 0) parts.push(t("imported", { count: imported }));
    if (progressErrors.length > 0) parts.push(t("errors", { count: progressErrors.length }));

    return parts;
  };

  let status = "";

  if (isStarting) {
    status = t("uploadingFile");
  } else if (isImporting && total > 0) {
    const details = [t("ofTotal", { current, total }), ...countParts()].join(", ");

    status = t("processing", { details });
  } else if (isComplete) {
    status = t("complete", { details: countParts().join(", ") });
  }

  return (
    <div className="col-span-full">
      <div
        aria-label={t("dropzoneLabel")}
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
          <DocumentArrowUpIcon aria-hidden className="text-muted mx-auto size-10" />
          <div className="text-muted mt-4 flex items-center justify-center gap-1 text-sm">
            <label
              className="text-accent focus-within:outline-primary hover:text-accent relative cursor-pointer rounded-md bg-transparent font-semibold focus-within:outline-2 focus-within:outline-offset-2"
              htmlFor="archive-file-upload"
            >
              <span>{isUploading ? t("uploading") : t("uploadFile")}</span>
              <input
                key={isComplete ? "reset" : "active"}
                ref={inputRef}
                accept=".norishrecipes,.melarecipes,.paprikarecipes,.zip"
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
        {(isImporting || isComplete) && total > 0 && (
          <ProgressBar
            aria-label={t("progressLabel")}
            className="w-full"
            color={isComplete ? (progressErrors.length > 0 ? "warning" : "success") : "accent"}
            size="sm"
            value={(current / total) * 100}
          />
        )}

        {status && <div className="text-muted text-base">{status}</div>}

        {/* Recipes that landed, minus something the archive carried */}
        {isComplete && notes.length > 0 && (
          <div className="text-muted text-sm">
            <button
              className="hover:text-foreground underline underline-offset-2"
              type="button"
              onClick={() => setShowNotes(!showNotes)}
            >
              {showNotes
                ? t("hideNotes", { count: notes.length })
                : t("showNotes", { count: notes.length })}
            </button>
            {showNotes && (
              <ul className="mt-1 list-disc pl-4">
                {notes.map((entry, i) => (
                  // An import log: it only appends, and a file can carry the same note twice.
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  <li key={i}>
                    {entry.file}: {entry.note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {progressErrors.length > 0 && (
          <ul className="text-danger list-disc pl-4 text-base">
            {progressErrors.map((e, i) => (
              // An import log: it only appends, and a file can fail the same way twice.
              // eslint-disable-next-line @eslint-react/no-array-index-key
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
