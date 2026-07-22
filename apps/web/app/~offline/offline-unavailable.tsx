"use client";

import { Alert, Button } from "@heroui/react";
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
      <Alert className="max-w-lg text-left" status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t("title")}</Alert.Title>
          <Alert.Description>{t("body")}</Alert.Description>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onPress={() => window.location.reload()}>
              {t("retry")}
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                // A full navigation, not a client-side route push: offline it
                // lands on the bootstrap dashboard; Live it loads the real page.
                window.location.href = "/";
              }}
            >
              {t("home")}
            </Button>
          </div>
        </Alert.Content>
      </Alert>
    </div>
  );
}
