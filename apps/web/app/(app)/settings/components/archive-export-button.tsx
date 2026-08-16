"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";

/**
 * A Recipe Archive download never settles into a page load, so nothing tells
 * the button when the stream started. The busy state is a fixed window whose
 * job is to stop a second press from opening a second export.
 */
const BUSY_WINDOW_MS = 3000;

/**
 * `viewer` exports everything the pressing user can see under the view
 * policy; `instance` exports every recipe on the server. Both go through the
 * same route, which authorises the instance scope itself.
 */
export type ArchiveExportScope = "viewer" | "instance";

const EXPORT_PATH = "/export/recipes";

export interface ArchiveExportButtonProps {
  label: string;
  scope?: ArchiveExportScope;
}

/**
 * Downloads a Recipe Archive of everything in scope. Just a button with a
 * busy state — the browser's own download UI is the progress.
 */
export default function ArchiveExportButton({ label, scope = "viewer" }: ArchiveExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleExport = () => {
    if (exporting) return;

    setExporting(true);
    window.location.assign(scope === "instance" ? `${EXPORT_PATH}?scope=instance` : EXPORT_PATH);

    resetTimer.current = setTimeout(() => setExporting(false), BUSY_WINDOW_MS);
  };

  return (
    <Button isPending={exporting} variant="primary" onPress={handleExport}>
      {label}
    </Button>
  );
}
