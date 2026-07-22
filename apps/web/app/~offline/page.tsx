"use client";

import { useTranslations } from "next-intl";

/**
 * The offline navigation fallback (ADR-0006): served by the service worker when
 * a document navigation fails and there is no cached copy of the requested page
 * — a deep link or an unvisited route while Offline. Pages visited while Live
 * are served from the runtime page cache and never reach this fallback.
 *
 * Deliberately outside the `(app)` group and free of data providers: the HTML
 * is precached at service-worker install time, so it must never embed a
 * signed-in user's data (ADR-0005) — it renders pure shell.
 */
export default function OfflineFallbackPage() {
  const t = useTranslations("common.offlineFallback");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
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
            // A full navigation, not a client-side route push: the SW serves "/"
            // from the runtime page cache when it was visited while Live.
            window.location.href = "/";
          }}
        >
          {t("home")}
        </button>
      </div>
    </main>
  );
}
