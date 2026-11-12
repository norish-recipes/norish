"use client";

import { useEffect, useState } from "react";
import { offlineEngine } from "@/lib/offline/engine";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

/**
 * Session Expiry met on a full load, which the server redirects here before any app code runs:
 * forget the Offline Cache and keep the Outbox. Answers whether that clear has settled.
 */
export function useForgetEndedSession(ended: boolean): boolean {
  const [settled, setSettled] = useState(!ended);

  useEffect(() => {
    if (!ended) return;

    void offlineEngine
      .clearForSignOut({ discardQueue: false })
      .catch((error: unknown) => log.error({ error }, "Failed to clear offline data"))
      .finally(() => setSettled(true));
  }, [ended]);

  return settled;
}
