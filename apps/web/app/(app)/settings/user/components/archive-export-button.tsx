"use client";

import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";


const BUSY_WINDOW_MS = 3000;

/**
 * Downloads all items the user has access too.
 */
export default function ArchiveExportButton() {
  const t = useTranslations("settings.user.archiveImport");
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
    window.location.assign("/export/recipes");

    resetTimer.current = setTimeout(() => setExporting(false), BUSY_WINDOW_MS);
  };

  return (
    <Button isPending={exporting} variant="primary" onPress={handleExport}>
      {t("export.button")}
    </Button>
  );
}
