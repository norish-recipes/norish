"use client";

import { useTranslations } from "next-intl";

/**
 * The explicit Offline-unavailable state (ADR-0009): shown by the offline
 * bootstrap for unsupported routes and for recipe ids outside the Warm Set,
 * so missing data is never presented as an empty or broken app.
 */
export function OfflineUnavailable() {
  const t = useTranslations("common.offlineFallback");

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="offline-unavailable"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image optimizes through a runtime endpoint the offline shell can't reach; the raw /logo.svg ships in the precached public/ scan, which is the point. */}
      <img aria-hidden alt="" className="size-12 opacity-80" src="/logo.svg" />
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="text-muted max-w-md text-sm">{t("body")}</p>
      <div className="flex gap-2">
        <button
          className="border-border rounded-lg border px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => window.location.reload()}
        >
          {t("retry")}
        </button>
        <button
          className="border-border bg-surface-secondary rounded-lg border px-4 py-2 text-sm font-medium"
          type="button"
          onClick={() => {
            // A full navigation, not a client-side route push: offline it lands
            // on the bootstrap dashboard; Live it loads the real page.
            window.location.href = "/";
          }}
        >
          {t("home")}
        </button>
      </div>
    </div>
  );
}
