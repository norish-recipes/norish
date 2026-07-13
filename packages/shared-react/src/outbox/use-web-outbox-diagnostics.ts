"use client";

import { useEffect, useMemo, useState } from "react";

import type { WebOutboxDiagnostics } from "./outbox-diagnostics";
import type { WebOutboxScope } from "./outbox-types";
import { readWebOutboxDiagnostics } from "./outbox-diagnostics";
import { WebOutboxRepository } from "./outbox-repository";

const repository = new WebOutboxRepository();

export function useWebOutboxDiagnostics(
  getScope: () => Promise<WebOutboxScope | null>
): WebOutboxDiagnostics {
  const [diagnostics, setDiagnostics] = useState<WebOutboxDiagnostics>(() => ({
    pending: 0,
    retrying: 0,
    quarantined: 0,
    terminal: 0,
    expired: 0,
    completed: 0,
    discarded: 0,
    attention: [],
  }));
  const scope = useMemo(() => getScope, [getScope]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const next = await readWebOutboxDiagnostics(repository, await scope());

      if (!cancelled) setDiagnostics(next);
    };

    void refresh();
    window.addEventListener("norish:web-outbox-changed", refresh);
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("norish:web-outbox-changed", refresh);
      window.clearInterval(interval);
    };
  }, [scope]);

  return diagnostics;
}
