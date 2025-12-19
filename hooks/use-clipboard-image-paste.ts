"use client";

import { useEffect, useCallback } from "react";

export interface ClipboardImagePasteOptions {
  enabled?: boolean;
  onFiles: (files: File[]) => void;
}

function extractFilesFromClipboardData(data: DataTransfer | null): File[] {
  if (!data) return [];

  const items = Array.from(data.items ?? []);
  const files: File[] = [];

  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();

    if (file) files.push(file);
  }

  return files;
}

export function useClipboardImagePaste({ enabled = true, onFiles }: ClipboardImagePasteOptions) {
  const handlePaste = useCallback(
    (clipboardData: DataTransfer | null, preventDefault?: () => void) => {
      const files = extractFilesFromClipboardData(clipboardData);

      if (files.length === 0) return;

      // Only intercept when the clipboard actually contains files.
      preventDefault?.();
      onFiles(files);
    },
    [onFiles]
  );

  useEffect(() => {
    if (!enabled) return;

    const onWindowPaste = (event: ClipboardEvent) => {
      handlePaste(event.clipboardData, () => event.preventDefault());
    };

    window.addEventListener("paste", onWindowPaste);

    return () => window.removeEventListener("paste", onWindowPaste);
  }, [enabled, handlePaste]);

  const getOnPasteHandler = useCallback(() => {
    return (event: React.ClipboardEvent<HTMLElement>) => {
      handlePaste(event.clipboardData, () => event.preventDefault());
    };
  }, [handlePaste]);

  return { getOnPasteHandler };
}
