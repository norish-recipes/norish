"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startArchiveDownload } from "@/lib/export/archive-download-client";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * `viewer` exports everything the pressing user can see under the view
 * policy; `instance` exports every recipe on the server. Both go through the
 * same route, which authorises the instance scope itself.
 */
export type ArchiveExportScope = "viewer" | "instance";

const EXPORT_PATH = "/export/recipes";

/**
 * How long the button stays busy when the browser took the download and left
 * no way to know when it ended. Purely a double-press guard — the streamed
 * path does not use it, because there the transfer itself says when it is done.
 */
const HANDOFF_GUARD_MS = 3000;

export interface ArchiveExportButtonProps {
  label: string;
  scope?: ArchiveExportScope;
}

function exportUrl(scope: ArchiveExportScope): string {
  return scope === "instance" ? `${EXPORT_PATH}?scope=instance` : EXPORT_PATH;
}

/**
 * Only reached if the export response arrives without naming itself; the
 * route's own `Content-Disposition` is what normally decides.
 */
const FALLBACK_FILE_NAME = "norish-recipes.norishrecipes";

/**
 * Downloads a Recipe Archive of everything in scope.
 *
 * Where the browser allows it the archive is streamed out through the service
 * worker, so the button stays busy for exactly as long as the transfer runs
 * and can show how much has gone. Everywhere else the browser takes the
 * download and the button falls back to a short guard. Either way an
 * unauthorised export is reported here rather than replacing the page.
 */
export default function ArchiveExportButton({ label, scope = "viewer" }: ArchiveExportButtonProps) {
  const t = useTranslations("settings.archiveExport");
  const [exporting, setExporting] = useState(false);
  const [bytes, setBytes] = useState(0);
  const guardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (guardTimer.current) clearTimeout(guardTimer.current);
    };
  }, []);

  const finish = useCallback(() => {
    if (!mounted.current) return;
    setExporting(false);
    setBytes(0);
  }, []);

  const handleExport = async () => {
    if (exporting) return;

    setExporting(true);
    setBytes(0);

    const outcome = await startArchiveDownload({
      url: exportUrl(scope),
      fallbackFileName: FALLBACK_FILE_NAME,
      onProgress: (transferred) => {
        if (mounted.current) setBytes(transferred);
      },
    });

    if (outcome.status === "failed") {
      const description =
        outcome.reason === "unauthorized"
          ? t("errors.signedOut")
          : outcome.reason === "forbidden"
            ? t("errors.notAllowed")
            : t("errors.failedDescription");

      showSafeErrorToast({
        title: t("errors.failedTitle"),
        description,
        error: "error" in outcome ? outcome.error : undefined,
        metadata: { scope },
        context: "archive-export",
      });
      finish();

      return;
    }

    if (outcome.status === "handedOff") {
      // Nothing will tell us when this ends, so only guard the second press.
      guardTimer.current = setTimeout(finish, HANDOFF_GUARD_MS);

      return;
    }

    finish();
  };

  return (
    <Button isPending={exporting} variant="primary" onPress={handleExport}>
      {exporting && bytes > 0 ? t("progress", { size: formatBytes(bytes) }) : label}
    </Button>
  );
}

/**
 * A streamed archive has no declared length, so there is no percentage to
 * show — only how much has arrived.
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
