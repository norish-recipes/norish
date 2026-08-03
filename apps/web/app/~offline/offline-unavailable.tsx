"use client";

import { useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { NoraCard } from "@/components/shared/nora-card";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

const AUTO_RELOAD_GUARD_PREFIX = "norish.offline-unavailable.reloaded:";

const guardKey = () => `${AUTO_RELOAD_GUARD_PREFIX}${window.location.pathname}`;

/**
 * The explicit Offline-unavailable state (ADR-0009): shown by the offline
 * bootstrap for unsupported routes and for recipe ids outside the Warm Set,
 * so missing data is never presented as an empty or broken app.
 *
 * When connectivity comes back it reloads the originally requested URL once
 * per path and session — the user asked for this page and it is reachable
 * now. Once that shot is spent the card flips to a "connection is back"
 * state and leaves the button to the user, so a network where only the
 * probe squeaks through can never reload in a loop.
 */
export function OfflineUnavailable() {
  const t = useTranslations("common.offlineFallback");
  const { posture } = useConnectivity();
  const [reloadSpent, setReloadSpent] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(guardKey()) !== null;
    } catch {
      // No storage means no loop protection — never auto-reload.
      return true;
    }
  });
  const postureRef = useRef(posture);

  useEffect(() => {
    const previous = postureRef.current;

    postureRef.current = posture;

    // Only a transition into Live counts: the machine starts optimistically
    // Live on a cold boot, and reacting to that initial value would reload
    // before the first probe has said anything.
    if (previous === "live" || posture !== "live" || reloadSpent) return;

    try {
      window.sessionStorage.setItem(guardKey(), "1");
    } catch {
      setReloadSpent(true);

      return;
    }
    window.location.reload();
  }, [posture, reloadSpent]);

  const backOnline = posture === "live" && reloadSpent;

  return (
    <div className="flex flex-1 items-center justify-center p-6" data-testid="offline-unavailable">
      <NoraCard
        message={backOnline ? t("backOnlineBody") : t("body")}
        title={backOnline ? t("backOnlineTitle") : t("title")}
      >
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button
            variant={backOnline ? "primary" : "secondary"}
            onPress={() => window.location.reload()}
          >
            {t("retry")}
          </Button>
          <Button
            variant={backOnline ? "secondary" : "primary"}
            onPress={() => {
              // A full navigation, not a client-side route push: offline it
              // lands on the bootstrap dashboard; Live it loads the real page.
              window.location.href = "/";
            }}
          >
            {t("home")}
          </Button>
        </div>
      </NoraCard>
    </div>
  );
}
